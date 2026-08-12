'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MemoryStorage {
  constructor(initial){ this.values = new Map(Object.entries(initial || {}).map(([key, value]) => [key, String(value)])); }
  get length(){ return this.values.size; }
  key(index){ return Array.from(this.values.keys())[index] ?? null; }
  getItem(key){ return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value){ this.values.set(String(key), String(value)); }
  removeItem(key){ this.values.delete(String(key)); }
  clear(){ this.values.clear(); }
}

class MiniClassList {
  constructor(){ this.values = new Set(); }
  add(...names){ names.forEach(name => this.values.add(String(name))); }
  remove(...names){ names.forEach(name => this.values.delete(String(name))); }
  contains(name){ return this.values.has(String(name)); }
  toggle(name, force){
    const enabled = force === undefined ? !this.contains(name) : !!force;
    enabled ? this.add(name) : this.remove(name);
    return enabled;
  }
  toString(){ return Array.from(this.values).join(' '); }
}

function createStyle(){
  const priorities = new Map();
  return {
    display:'', overflow:'', position:'', left:'',
    setProperty(name, value, priority){ this[name] = String(value); priorities.set(String(name), String(priority || '')); },
    getPropertyValue(name){ return this[name] == null ? '' : String(this[name]); },
    getPropertyPriority(name){ return priorities.get(String(name)) || ''; },
    removeProperty(name){ const previous=this.getPropertyValue(name); delete this[name]; priorities.delete(String(name)); return previous; }
  };
}

class MiniElement {
  constructor(tagName, ownerDocument, id){
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument || null;
    this.id = id || '';
    this.dataset = {};
    this.style = createStyle();
    this.classList = new MiniClassList();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.hidden = false;
    this.disabled = false;
    this.inert = false;
    this.isConnected = true;
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.files = [];
    this.listeners = new Map();
    this.offsetParent = this;
  }
  get lastChild(){ return this.children[this.children.length - 1] || null; }
  setAttribute(name, value){
    const key = String(name);
    const text = String(value);
    this.attributes.set(key, text);
    if(key === 'id') this.id = text;
    if(key === 'class'){
      this.classList = new MiniClassList();
      text.split(/\s+/).filter(Boolean).forEach(item => this.classList.add(item));
    }
  }
  getAttribute(name){ return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null; }
  removeAttribute(name){ this.attributes.delete(String(name)); }
  appendChild(child){
    if(child.parentElement){
      const index = child.parentElement.children.indexOf(child);
      if(index >= 0) child.parentElement.children.splice(index, 1);
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  removeChild(child){
    const index = this.children.indexOf(child);
    if(index < 0) return child;
    this.children.splice(index, 1);
    child.parentElement = null;
    return child;
  }
  remove(){
    if(!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if(index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
    this.isConnected = false;
  }
  contains(node){ return node === this || this.children.some(child => child.contains(node)); }
  addEventListener(type, callback){
    const key = String(type);
    if(!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(callback);
  }
  dispatchEvent(event){
    if(!event.target) event.target = this;
    event.currentTarget = this;
    (this.listeners.get(event.type) || []).forEach(callback => callback.call(this, event));
    return !event.defaultPrevented;
  }
  click(){ this.dispatchEvent(createEvent('click', {target:this})); }
  focus(){ if(this.ownerDocument) this.ownerDocument.activeElement = this; }
  select(){}
  querySelector(){ return null; }
  querySelectorAll(){ return []; }
  closest(){ return null; }
}

class MiniDocument {
  constructor(){
    this.elements = new Map();
    this.selectors = new Map();
    this.listeners = new Map();
    this.readyState = 'complete';
    this.title = 'NutriApp';
    this.body = new MiniElement('body', this, 'body');
    this.head = new MiniElement('head', this, 'head');
    this.activeElement = this.body;
    this.register(this.body);
    this.register(this.head);
  }
  register(element){ element.ownerDocument=this; if(element.id) this.elements.set(element.id, element); return element; }
  createElement(tagName){ return new MiniElement(tagName, this); }
  createElementWithId(id, tagName){ return this.register(new MiniElement(tagName || 'div', this, id)); }
  getElementById(id){ return this.elements.get(String(id)) || null; }
  mapSelector(selector, value){ this.selectors.set(String(selector), value); }
  querySelector(selector){
    const value = this.selectors.get(String(selector));
    return Array.isArray(value) ? (value[0] || null) : (value || null);
  }
  querySelectorAll(selector){
    const value = this.selectors.get(String(selector));
    if(!value) return [];
    return Array.isArray(value) ? value.slice() : [value];
  }
  addEventListener(type, callback){
    const key = String(type);
    if(!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(callback);
  }
  dispatchEvent(event){
    if(!event.target) event.target = this;
    (this.listeners.get(event.type) || []).forEach(callback => callback.call(this, event));
    return !event.defaultPrevented;
  }
  execCommand(){ return true; }
}

function createEvent(type, extra){
  return Object.assign({
    type:String(type), target:null, currentTarget:null, key:'', shiftKey:false, defaultPrevented:false,
    preventDefault(){ this.defaultPrevented=true; }, stopPropagation(){}, stopImmediatePropagation(){ this.immediatePropagationStopped=true; }
  }, extra || {});
}

function createBrowserHarness(options){
  const settings = options || {};
  const document = settings.document || new MiniDocument();
  const localStorage = settings.localStorage || new MemoryStorage(settings.storage);
  const windowListeners = new Map();
  const historyCalls = [];
  const location = Object.assign({hash:'#ingredients', protocol:'file:'}, settings.location || {});
  const window = Object.assign({
    document,
    localStorage,
    location,
    navigator:{clipboard:{writeText:async () => true}},
    history:{
      pushState(_state, _title, hash){ historyCalls.push(['push',hash]); location.hash=hash; },
      replaceState(_state, _title, hash){ historyCalls.push(['replace',hash]); location.hash=hash; }
    },
    addEventListener(type, callback){ windowListeners.set(String(type), callback); },
    dispatchEvent(event){ const callback=windowListeners.get(event.type); if(callback) callback.call(window,event); return true; },
    requestAnimationFrame(callback){ callback(); return 1; },
    setTimeout,
    clearTimeout,
    CustomEvent:function(type, init){ return createEvent(type, {detail:init && init.detail}); },
    alert(){},
    confirm(){ return true; }
  }, settings.window || {});
  window.window = window;

  const context = vm.createContext({
    window,
    document,
    localStorage,
    navigator:window.navigator,
    location,
    console,
    setTimeout,
    clearTimeout,
    Blob:globalThis.Blob,
    URL:globalThis.URL,
    CustomEvent:window.CustomEvent,
    alert:window.alert,
    confirm:window.confirm
  });

  function loadClassicScript(filename){
    const absolute = path.resolve(filename);
    const source = fs.readFileSync(absolute, 'utf8');
    vm.runInContext(source, context, {filename:absolute});
    return window;
  }

  return {window, document, localStorage, historyCalls, windowListeners, context, loadClassicScript};
}

module.exports = {MemoryStorage, MiniClassList, MiniElement, MiniDocument, createEvent, createBrowserHarness};
