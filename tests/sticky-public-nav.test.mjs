import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../components/Dashboard.tsx',import.meta.url),'utf8');
test('public header remains sticky for the full dashboard scroll',()=>{
 assert.match(dashboard,/<main className="page">[\s\S]*?<header className="topnav">/);
 assert.match(css,/\.page>\.topnav\{\s*position:sticky;top:0;z-index:75/);
 assert.match(css,/\.page #monitoring,\.page #visual-analytics,\.page #reports,\.page #health,\.page #records\{scroll-margin-top:112px\}/);
});
test('narrow browsers keep all nav links reachable by horizontal scrolling',()=>{
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain/);
 assert.match(css,/\.page>\.topnav \.navlink\{flex-shrink:0/);
 assert.match(css,/\.page>\.topnav \.navright\{\s*display:flex;flex:1/);
});
test('administrator sticky navigation is retained separately',()=>{
 assert.match(css,/\.admin-sticky-nav\{\s*position:sticky;top:0/);
});
