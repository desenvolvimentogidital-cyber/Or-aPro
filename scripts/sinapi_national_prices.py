#!/usr/bin/env python3
"""SINAPI Referência XLSX -> importação nacional PostgreSQL em lotes CSV.

Converte SOMENTE tabelas oficiais CSD/CCD e ISD/ICD da mesma competência.
Sem dependências externas, sem conexões ao banco e sem gravar produção.
  python scripts/sinapi_national_prices.py arquivo.xlsx --check-only
  python scripts/sinapi_national_prices.py arquivo.xlsx --out-dir dados-sinapi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f dados-sinapi/import.sql
O último comando só deve ser executado após backup e aprovação da publicação.
"""
import argparse
import csv
import json
import re
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'
UFS = ('AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
       'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO')
SHEETS = {'CSD':('composicoes','sem_desoneracao'),
          'CCD':('composicoes','com_desoneracao'),
          'ISD':('insumos','sem_desoneracao'),
          'ICD':('insumos','com_desoneracao')}
CODE_CELL = re.compile(r'^([A-Z]+)\d+$')
CODE_FORMULA = re.compile(r',\s*(\d{3,8})\s*\)\s*$')
PERIOD = re.compile(r'^(0[1-9]|1[0-2])/20\d{2}$')


def read_strings(archive):
    root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
    return [''.join(v.text or '' for v in item.iter(NS+'t'))
            for item in root.findall(NS+'si')]


def sheet_paths(archive):
    book=ET.fromstring(archive.read('xl/workbook.xml'))
    rel=ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    relations={e.attrib['Id']:e.attrib['Target'] for e in rel.findall(REL+'Relationship')}
    result={}
    for sheet in book.findall(NS+'sheets/'+NS+'sheet'):
        rel_id=next((v for k,v in sheet.attrib.items() if k.endswith('}id')),None)
        path=relations.get(rel_id,'')
        if path.startswith('/'):path=path.lstrip('/')
        elif not path.startswith('xl/'):path='xl/'+path.removeprefix('./')
        if path.startswith('xl/worksheets/') and path.endswith('.xml'):
            result[sheet.attrib['name'].upper()]=path
    return result


def iter_rows(archive,name,strings):
    with archive.open(name) as handle:
        for _,elem in ET.iterparse(handle,events=('end',)):
            if elem.tag!=NS+'row':continue
            cells,formula={},{}
            for c in elem.findall(NS+'c'):
                m=CODE_CELL.match(c.attrib.get('r',''))
                if not m:continue
                col=m.group(1)
                v=c.find(NS+'v')
                text=v.text if v is not None and v.text else ''
                if c.get('t')=='s' and text:text=strings[int(text)]
                if c.get('t')=='inlineStr':
                    text=''.join(t.text or '' for t in c.iter(NS+'t'))
                cells[col]=text
                f=c.find(NS+'f')
                if f is not None and f.text:formula[col]=f.text
            yield int(elem.attrib.get('r','0')),cells,formula
            elem.clear()


def cents(value,ref):
    if not value or value.strip() in ('-','–','—'):return None
    try:price=Decimal(value.strip())
    except InvalidOperation as ex:raise ValueError(f'{ref}: preço inválido {value!r}') from ex
    if not price.is_finite() or price<0 or price>Decimal('1000000000'):
        raise ValueError(f'{ref}: preço fora de faixa {value!r}')
    if not price:return None  # zeros e hífens não são preço confirmado
    return int((price*100).quantize(Decimal(1),rounding=ROUND_HALF_UP))


def extract(path):
    if path.stat().st_size>45_000_000:raise ValueError('Arquivo excede 45 MB')
    all_rows={'composicoes':{},'insumos':{}}
    report={'file':path.name,'reference':None,'states':list(UFS),
            'sheets':{},'by_state':defaultdict(int)}
    with ZipFile(path) as z:
        paths=sheet_paths(z)
        if not set(SHEETS).issubset(paths):
            raise ValueError('Arquivo sem as quatro abas oficiais CSD/CCD/ISD/ICD')
        strings=read_strings(z)
        for sheet,(kind,regime) in SHEETS.items():
            total=priced=missing=0
            states={}
            seen=set()
            for n,c,formulas in iter_rows(z,paths[sheet],strings):
                if n==3:
                    period=c.get('B','')
                    if not PERIOD.fullmatch(period):
                        raise ValueError(f'{sheet}: competência inválida')
                    if report['reference'] and report['reference']!=period:
                        raise ValueError('Competências divergentes nas quatro abas')
                    report['reference']=period
                if n==(4 if kind=='composicoes' else 10):
                    states={k:v for k,v in c.items() if v in UFS}
                    if len(states)!=27 or set(states.values())!=set(UFS):
                        raise ValueError(f'{sheet}: cabeçalho de 27 UFs incompleto')
                if n<=10:continue
                unit=c.get('D','').strip().upper()
                if kind=='composicoes':
                    m=CODE_FORMULA.search(formulas.get('B',''))
                    if not m:raise ValueError(f'{sheet}!B{n}: código de composição sem fórmula segura')
                    code=m.group(1)
                else:
                    code=c.get('B','').strip()
                    if not re.fullmatch(r'\d{1,8}',code):
                        raise ValueError(f'{sheet}!B{n}: código de insumo inválido')
                if not 1<=len(unit)<=30:raise ValueError(f'{sheet}!D{n}: unidade inválida')
                key=(code,unit)
                if key in seen:raise ValueError(f'{sheet}: código/unidade duplicados: {key}')
                seen.add(key)
                classification=c.get('A','').strip().upper() if kind=='insumos' else None
                items=all_rows[kind]
                if key not in items:
                    items[key]={'reference':period,'code':code,'unit':unit,
                                'classification':classification,'costs':{}}
                entry=items[key]
                if entry['classification']!=classification:
                    raise ValueError(f'{sheet}: classificação diferente do regime oposto')
                current=entry['costs'].setdefault(regime,{})
                for col,uf in states.items():
                    # CSD/CCD têm colunas intercaladas com %AS; states já escolheu só preços.
                    amount=cents(c.get(col,''),f'{sheet}!{col}{n}')
                    if amount is None:missing+=1;continue
                    current[uf]=amount
                    priced+=1
                    report['by_state'][kind+'/'+regime+'/'+uf]+=1
                total+=1
            if total<(10000 if kind=='composicoes' else 4000):
                raise ValueError(f'{sheet}: dados incompletos ({total} registros)')
            report['sheets'][sheet]={'rows':total,'priced_cells':priced,'missing_cells':missing}
    report['composition_rows']=len(all_rows['composicoes'])
    report['input_rows']=len(all_rows['insumos'])
    report['by_state']=dict(sorted(report['by_state'].items()))
    if len(report['by_state'])!=108:raise ValueError('Faltam UFs ou regimes nas quatro abas')
    return all_rows,report


def csv_file(output,records,source_file):
    if len(source_file)>170:raise ValueError('Nome do arquivo de referência muito longo')
    with output.open('w',encoding='utf-8',newline='') as handle:
        writer=csv.writer(handle)
        for key in sorted(records):
            row=records[key]
            fields=[row['reference'],row['code'],row['unit']]
            if row['classification'] is not None:fields.append(row['classification'][:80])
            fields.extend([json.dumps(row['costs'],sort_keys=True,separators=(',',':')),
                           source_file+' (SINAPI CSD/CCD/ISD/ICD)'])
            writer.writerow(fields)


def sql_import(folder,reference):
    sql=['\\set ON_ERROR_STOP on','BEGIN;']
    for kind,table,cols in (
      ('composicoes','public.orcapro_sinapi_published_unit_costs',
       'reference,code,unit,costs_in_cents,source_file'),
      ('insumos','public.orcapro_sinapi_published_inputs',
       'reference,code,unit,classification,costs_in_cents,source_file')):
        temp='sinapi_stage_'+kind
        file=(folder/(kind+'.csv')).resolve().as_posix().replace("'","''")
        sql.extend([
            f'CREATE TEMP TABLE {temp} (LIKE {table} INCLUDING DEFAULTS) ON COMMIT DROP;',
            f"\\copy {temp} ({cols}) FROM '{file}' WITH (FORMAT csv, ENCODING 'UTF8');",
            f"""DO $$ BEGIN
              IF EXISTS (SELECT 1 FROM {temp} WHERE reference<>'{reference}') THEN
                RAISE EXCEPTION 'Competência inválida no CSV {kind}'; END IF;
              IF EXISTS (
                SELECT 1 FROM {temp} s JOIN {table} t USING (reference,code,unit)
                CROSS JOIN LATERAL jsonb_each(t.costs_in_cents) regime
                CROSS JOIN LATERAL jsonb_each_text(regime.value) uf
                WHERE s.costs_in_cents #>> ARRAY[regime.key,uf.key] IS NOT NULL
                AND (s.costs_in_cents #>> ARRAY[regime.key,uf.key])::numeric <> uf.value::numeric
              ) THEN RAISE EXCEPTION 'Preço publicado divergente em {kind}; revisar manualmente'; END IF;
            END $$;""",
            f"""INSERT INTO {table} ({cols}) SELECT {cols} FROM {temp}
              ON CONFLICT (reference,code,unit) DO UPDATE SET costs_in_cents =
              jsonb_build_object(
               'sem_desoneracao',coalesce({table}.costs_in_cents->'sem_desoneracao','{{}}'::jsonb)||
                                coalesce(EXCLUDED.costs_in_cents->'sem_desoneracao','{{}}'::jsonb),
               'com_desoneracao',coalesce({table}.costs_in_cents->'com_desoneracao','{{}}'::jsonb)||
                                coalesce(EXCLUDED.costs_in_cents->'com_desoneracao','{{}}'::jsonb));""",
            f"SELECT count(*) AS published_{kind} FROM {table} WHERE reference='{reference}';"
        ])
    return '\n'.join(sql+['COMMIT;','-- Dados importados apenas após validação/backup explícitos.'])+'\n'


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('xlsx',type=Path)
    cli.add_argument('--out-dir',type=Path,default=Path('sinapi-nacional-export'))
    cli.add_argument('--check-only',action='store_true')
    args=cli.parse_args()
    items,summary=extract(args.xlsx)
    print(json.dumps({k:v for k,v in summary.items() if k!='by_state'},ensure_ascii=False,indent=2))
    if args.check_only:return
    args.out_dir.mkdir(parents=True,exist_ok=True)
    for kind,rows in items.items():
        csv_file(args.out_dir/(kind+'.csv'),rows,args.xlsx.name)
    (args.out_dir/'summary.json').write_text(
        json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.out_dir/'import.sql').write_text(
        sql_import(args.out_dir,summary['reference']),encoding='utf-8')
    print('Importação PREPARADA, sem gravações no banco:',args.out_dir.resolve())


if __name__=='__main__':
    main()
