import test from 'node:test';import assert from 'node:assert/strict';
import {sinapiLocalSalePrice} from '../.test-dist/utils/sinapiLocalSale.js';
test('adjusts user sales price but preserves official unit cost input',()=>{
 const raw=148.29;const sell=sinapiLocalSalePrice(raw,20);
 assert.equal(sell,177.95);assert.equal(raw,148.29);
});
test('rejects unsupported percentage, invalid cost and negative discounts',()=>{
 for(const adjust of [NaN,-5,301,Infinity])
 assert.throws(()=>sinapiLocalSalePrice(148.29,adjust));
 assert.throws(()=>sinapiLocalSalePrice(0,15));
});