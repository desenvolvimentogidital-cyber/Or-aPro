import test from 'node:test';
import assert from 'node:assert/strict';
import {modeForViewport, LAYOUT_BREAKPOINT} from '../.test-dist/utils/viewMode.js';
test('celulares estreitos sempre iniciam no modo mobile de tela cheia',()=>{
  for(const width of [320,360,375,390,414,430,540,640,767])assert.equal(modeForViewport(width),'mobile');
});
test('tablets amplos, notebooks e monitores iniciam no modo web',()=>{
  assert.equal(LAYOUT_BREAKPOINT,768);
  for(const width of [768,820,1024,1280,1440,1920,2560])assert.equal(modeForViewport(width),'responsive');
});
