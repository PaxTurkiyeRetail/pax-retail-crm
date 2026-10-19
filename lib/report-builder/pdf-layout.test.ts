import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { loadPdfFonts, pdfColumnWidths, renderPagePdf, wrapPdfText } from './pdf';
import { parsePageDefinition } from './page-types';

describe('PDF table layout',()=>{
  it('fits positive weighted columns exactly within the available width',()=>{
    const widths=pdfColumnWidths(500,[3,1,2]);
    expect(widths.reduce((a,b)=>a+b,0)).toBeCloseTo(500);
    expect(widths[0]/widths[1]).toBeCloseTo(3);
    expect(widths.every(w=>w>0)).toBe(true);
  });
  it('wraps a long unbroken company name without ellipsis or lost characters',()=>{
    const text='ÇokUzunTicaretVeSanayiAnonimŞirketi';
    const lines=wrapPdfText({widthOfTextAtSize:(s)=>s.length*5},text,8,35);
    expect(lines.length).toBeGreaterThan(1);expect(lines.join('')).toBe(text);
    expect(lines.every(s=>s.length*5<=35)).toBe(true);
  });
  it('renders full names on multiple pages and repeats table headers',async()=>{
    const drawn:string[]=[];
    const original=PDFPage.prototype.drawText;
    const spy=vi.spyOn(PDFPage.prototype,'drawText').mockImplementation(function(this:PDFPage,text,options){drawn.push(text);return original.call(this,text,options);});
    try {
      const page=parsePageDefinition({version:1,title:'Şirketler',widgets:[{id:'table',title:'Şirketler',type:'table',layout:{lg:{x:0,y:0,w:12,h:8}},query:{dataset:'customers',measures:['customer_count']},style:{columns:[{key:'company',width:3},{key:'value',width:1}]}}],pdf:{fontSize:10,wordWrap:true}});
      const company='ÇokUzunTicaretVeSanayiAnonimŞirketi'.repeat(4);
      const bytes=await renderPagePdf({page,fonts:await loadPdfFonts(),date:'2026-10-19',data:{table:{result:{columns:[{key:'company',label:'Firma',role:'dimension',type:'string'},{key:'value',label:'Adet',role:'measure',type:'number'}],rows:Array.from({length:70},(_,i)=>({company,value:i})),truncated:false,range:null,compareRange:null,durationMs:1}}}});
      const pdf=await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(1);
      expect(drawn.filter(t=>t==='Firma')).toHaveLength(pdf.getPageCount());
      expect(drawn.filter(t=>t==='Şirketler')).toHaveLength(1);
      expect(drawn.some(t=>t.includes('…'))).toBe(false);
      const fragments=drawn.filter(t=>t!=='Firma'&&t!=='Adet'&&t!=='Şirketler'&&!/^\d/.test(t));
      expect(fragments.join('')).toContain(company);
    }finally{spy.mockRestore();}
  },20_000);
});
