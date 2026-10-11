import importlib.util
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import unittest

MODULE=Path(__file__).resolve().parents[1]/'scripts'/'sinapi_national_prices.py'
spec=importlib.util.spec_from_file_location('prices',MODULE)
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
UFS=p.UFS

def colname(n):
    chars=''
    while n:
        n,r=divmod(n-1,26)
        chars=chr(65+r)+chars
    return chars

def cell(c,r,value):
    return f'<c r="{c}{r}" t="inlineStr"><is><t>{value}</t></is></c>'

def worksheet(sheet):
    is_comp=sheet in ('CSD','CCD')
    rows=['<row r="3">'+cell('B',3,'09/2026')+'</row>']
    header_row=4 if is_comp else 10
    head=''.join(cell(colname(5+2*i if is_comp else 6+i),header_row,uf)
                 for i,uf in enumerate(UFS))
    rows.append(f'<row r="{header_row}">{head}</row>')
    for i in range(10000 if is_comp else 4000):
        row=i+11
        code=100000+i if is_comp else 1000+i
        a=cell('A',row,'ALVENARIA' if is_comp else 'MATERIAL')
        b=(f'<c r="B{row}"><f>HYPERLINK("#",{code})</f><v>0</v></c>'
           if is_comp else cell('B',row,str(code)))
        cols=a+b+cell('D',row,'M2' if is_comp else 'UN')
        if i==0:
            cols+=''.join(
                f'<c r="{colname(5+2*j if is_comp else 6+j)}{row}"><v>{100+j/10}</v></c>'
                for j in range(27))
        else:
            cols+=f'<c r="{colname(5 if is_comp else 6)}{row}"><v>10.01</v></c>'
        rows.append(f'<row r="{row}">{cols}</row>')
    return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="'+NS+'"><sheetData>'+''.join(rows)+'</sheetData></worksheet>'

def fixture(path):
    book='<?xml version="1.0"?><workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+''.join(
        f'<sheet name="{name}" sheetId="{n}" r:id="rId{n}"/>'
        for n,name in enumerate(('ISD','ICD','CSD','CCD'),1))+'</sheets></workbook>'
    rel='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(
        f'<Relationship Id="rId{n}" Target="worksheets/sheet{n}.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>'
        for n in range(1,5))+'</Relationships>'
    with ZipFile(path,'w',compression=ZIP_DEFLATED) as z:
        z.writestr('xl/workbook.xml',book)
        z.writestr('xl/_rels/workbook.xml.rels',rel)
        z.writestr('xl/sharedStrings.xml','<sst xmlns="'+NS+'"/>')
        for n,name in enumerate(('ISD','ICD','CSD','CCD'),1):
            z.writestr(f'xl/worksheets/sheet{n}.xml',worksheet(name))

class NationalPrices(unittest.TestCase):
    def test_reject_empty_zero_negative_and_keep_cents(self):
        self.assertEqual(p.cents('148.29','sample'),14829)
        for s in ('','-','0'):
            self.assertIsNone(p.cents(s,'missing'))
        with self.assertRaises(ValueError):
            p.cents('-8','negative')
    def test_xlsx_27_states_two_regimes_and_never_invent_missing_price(self):
        with tempfile.TemporaryDirectory() as d:
            x=Path(d)/'SINAPI_2026_09.xlsx'
            fixture(x)
            data,meta=p.extract(x)
            self.assertEqual(meta['reference'],'09/2026')
            self.assertEqual(meta['composition_rows'],10000)
            self.assertEqual(meta['input_rows'],4000)
            self.assertEqual(len(meta['by_state']),108)
            self.assertEqual(data['composicoes'][('100000','M2')]['costs']['sem_desoneracao']['PR'],10170)
            self.assertNotIn('PR',data['composicoes'][('100001','M2')]['costs']['sem_desoneracao'])
            sql=p.sql_import(Path(d),'09/2026')
            self.assertIn('Preço publicado divergente',sql)
            self.assertIn('Classificação de insumo publicado divergente',sql)
            self.assertIn('ON CONFLICT (reference,code,unit)',sql)
            self.assertIn('COMMIT;',sql)
            p.csv_file(Path(d)/'insumos.csv',data['insumos'],x.name)
            self.assertTrue((Path(d)/'insumos.csv').exists())

if __name__=='__main__':
    unittest.main()
