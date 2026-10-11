import importlib.util
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile,ZIP_DEFLATED

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('analytical',ROOT/'scripts'/'sinapi_analytical_items.py')
import sys
sys.path.insert(0,str(ROOT/'scripts'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'

def textcell(col,index,text):
    return f'<c r="{col}{index}" t="inlineStr"><is><t>{text}</t></is></c>'
def fixture(file):
    head='<?xml version="1.0"?><worksheet xmlns="'+NS+'"><sheetData><row r="3">'+textcell('B',3,'09/2026')+'</row>'
    rows=[head]
    counter=11
    for i in range(10000):
        code=str(100000+i)
        rows.append(f'<row r="{counter}">'+textcell('B',counter,code)+textcell('F',counter,'M2')+'</row>')
        counter+=1
        for k in range(5):
            rows.append(f'<row r="{counter}">'+textcell('B',counter,code)+textcell('C',counter,'INSUMO')+
                textcell('D',counter,str(1000+k))+textcell('F',counter,'UN')+
                f'<c r="G{counter}"><v>0.625</v></c>'+
                textcell('H',counter,'COM PREÇO')+'</row>')
            counter+=1
    rows.append('</sheetData></worksheet>')
    workbook='<?xml version="1.0"?><workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Analítico" sheetId="1" r:id="rId1"/></sheets></workbook>'
    rel='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>'
    with ZipFile(file,'w',compression=ZIP_DEFLATED) as z:
        z.writestr('xl/workbook.xml',workbook)
        z.writestr('xl/_rels/workbook.xml.rels',rel)
        z.writestr('xl/sharedStrings.xml','<sst xmlns="'+NS+'"/>')
        z.writestr('xl/worksheets/sheet1.xml',''.join(rows))

class AnalyticReference(unittest.TestCase):
    def test_graph_has_true_coefficients_and_private_safe_output(self):
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/'SINAPI_2026_09.xlsx'
            fixture(file)
            result,meta=m.extract_analytical(file)
            self.assertEqual(meta['reference'],'09/2026')
            self.assertEqual(meta['compositions'],10000)
            self.assertEqual(meta['items'],50000)
            children=result[('100000','M2')]
            self.assertEqual(len(children),5)
            self.assertEqual(children[0]['coefficient'],'0.625')
            self.assertEqual(children[0]['status'],'COM PREÇO')
            summary=m.export(file,Path(d)/'export')
            self.assertEqual(summary['items'],50000)
            self.assertTrue((Path(d)/'export'/'analitico.csv').exists())
            sql=(Path(d)/'export'/'import_analytical.sql').read_text()
            self.assertIn('DO NOTHING',sql)
            self.assertIn('divergente',sql)

if __name__=='__main__':
    unittest.main()
