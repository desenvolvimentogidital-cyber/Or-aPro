#!/usr/bin/env python3
"""Exporta itens analíticos SINAPI (coeficientes sem preços inventados).

Requer a planilha completa da mesma competência dos CSVs CSD/CCD e ISD/ICD.
Este comando apenas PREPARA os arquivos; não acessa produção nem modifica preços.
  python scripts/sinapi_analytical_items.py SINAPI_Referência_2026_09.xlsx --out-dir dados-sinapi
Depois do backup e da migração correspondente, executar manualmente import_analytical.sql.
"""
import argparse
import csv
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re
from zipfile import ZipFile
from sinapi_national_prices import sheet_paths, read_strings, iter_rows, PERIOD

TYPE={'INSUMO':'input','COMPOSICAO':'composition'}
STATUS={'COM CUSTO','SEM CUSTO','COM PREÇO','SEM PREÇO','EM ESTUDO'}
CODE=re.compile(r'^\d{3,8}$')
INPUT_CODE=re.compile(r'^\d{1,8}$')


def extract_analytical(path):
    result={}
    by_code={}
    competence=None
    count=0
    with ZipFile(path) as archive:
        sheets=sheet_paths(archive)
        if 'ANALÍTICO' not in sheets:
            raise ValueError('Aba Analítico não encontrada (não confundir com Analítico com Custo).')
        strings=read_strings(archive)
        for index,row,_ in iter_rows(archive,sheets['ANALÍTICO'],strings):
            if index==3:
                competence=row.get('B','')
                if not PERIOD.fullmatch(competence):
                    raise ValueError('Competência Analítico ausente ou inválida.')
            if index<=10:continue
            parent=row.get('B','').strip()
            item_type=row.get('C','').strip().upper()
            if not CODE.fullmatch(parent):
                raise ValueError(f'Analítico!B{index}: código principal inválido.')
            if not item_type:
                unit=row.get('F','').strip().upper()
                if not unit or len(unit)>30:
                    raise ValueError(f'Analítico!F{index}: unidade da composição inválida.')
                key=(parent,unit)
                if key in result:raise ValueError(f'Composição repetida na aba Analítico: {key}')
                result[key]=[]
                if parent in by_code:
                    raise ValueError(f'Código de composição com unidades duplicadas: {parent}')
                by_code[parent]=key
            else:
                if item_type not in TYPE:
                    raise ValueError(f'Analítico!C{index}: tipo não suportado {item_type!r}')
                child_code=row.get('D','').strip()
                if not (CODE if item_type=='COMPOSICAO' else INPUT_CODE).fullmatch(child_code):
                    raise ValueError(f'Analítico!D{index}: código de item inválido.')
                child_unit=row.get('F','').strip().upper()
                if not child_unit or len(child_unit)>30:
                    raise ValueError(f'Analítico!F{index}: unidade de insumo inválida.')
                try: coefficient=Decimal(row.get('G','').strip())
                except InvalidOperation as ex:
                    raise ValueError(f'Analítico!G{index}: coeficiente inválido.') from ex
                if not coefficient.is_finite() or coefficient<=0 or coefficient>Decimal('100000000'):
                    raise ValueError(f'Analítico!G{index}: coeficiente fora de faixa.')
                status=row.get('H','').strip().upper()
                if status not in STATUS:
                    raise ValueError(f'Analítico!H{index}: situação inválida {status!r}')
                # A identidade pai é (código, unidade). O cabeçalho deve vir ANTES dos filhos;
                # uma composição com o mesmo código e múltiplas unidades não pode ser adivinhada.
                parent_key=by_code.get(parent)
                if parent_key is None:
                    raise ValueError(f'Analítico linha {index}: composição principal ausente {parent}.')
                result[parent_key].append({'type':TYPE[item_type],
                    'code':child_code,'unit':child_unit,
                    'coefficient':str(coefficient),'status':status})
                count+=1
    if len(result)<10000 or count<50000:
        raise ValueError(f'Analítico incompleto: {len(result)} composições / {count} itens.')
    return result,{'reference':competence,'compositions':len(result),'items':count,
                    'file':path.name}


def export(path,out):
    items,summary=extract_analytical(path)
    out.mkdir(parents=True,exist_ok=True)
    filename=out/'analitico.csv'
    with filename.open('w',encoding='utf-8',newline='') as fh:
        w=csv.writer(fh)
        for (code,unit),children in sorted(items.items()):
            w.writerow([summary['reference'],code,unit,
                        json.dumps(children,ensure_ascii=False,separators=(',',':')),
                        path.name+' (SINAPI Analítico)'])
    target='public.orcapro_sinapi_published_analytical'
    escaped=filename.resolve().as_posix().replace("'","''")
    sql=r''' \set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE sinapi_analytical_stage (LIKE public.orcapro_sinapi_published_analytical INCLUDING DEFAULTS) ON COMMIT DROP;
'''.strip()+f"""
\\copy sinapi_analytical_stage (reference,code,unit,items,source_file) FROM '{escaped}' WITH (FORMAT csv,ENCODING 'UTF8');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sinapi_analytical_stage WHERE reference<>'{summary['reference']}') THEN
    RAISE EXCEPTION 'Analítico com competência diferente'; END IF;
  IF EXISTS (
    SELECT 1 FROM sinapi_analytical_stage s
    JOIN {target} t USING (reference,code,unit)
    WHERE s.items<>t.items
  ) THEN RAISE EXCEPTION 'Composição analítica publicada divergente; revisar'; END IF;
END $$;
INSERT INTO {target} (reference,code,unit,items,source_file)
SELECT reference,code,unit,items,source_file FROM sinapi_analytical_stage
ON CONFLICT (reference,code,unit) DO NOTHING;
COMMIT;
"""
    (out/'import_analytical.sql').write_text(sql,encoding='utf-8')
    (out/'analytical_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary


if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('xlsx',type=Path)
    a.add_argument('--out-dir',type=Path,default=Path('sinapi-nacional-export'))
    x=a.parse_args()
    print(json.dumps(export(x.xlsx,x.out_dir),ensure_ascii=False,indent=2))
