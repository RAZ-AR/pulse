/* ayoo design-canvas runtime (standalone).
   Minimal engine for .dc.html mockups: <x-dc> template with {{ }} bindings,
   <sc-if>, <sc-for>, a tiny React.createElement, and a DCLogic base class.
   Only loaded when the real design tool hasn't already provided these globals. */
(function () {
  if (window.DCLogic && window.React) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SVG_TAGS = { svg:1, g:1, path:1, circle:1, rect:1, ellipse:1, line:1, polyline:1, polygon:1, text:1, defs:1, linearGradient:1, radialGradient:1, stop:1 };
  var ATTR_MAP = { className:'class', strokeWidth:'stroke-width', strokeLinecap:'stroke-linecap', strokeLinejoin:'stroke-linejoin', shapeRendering:'shape-rendering', fillOpacity:'fill-opacity', strokeOpacity:'stroke-opacity', clipPath:'clip-path' };

  // ---- tiny React ----
  var React = {
    createElement: function (type, props) {
      var children = [];
      for (var i = 2; i < arguments.length; i++) children.push(arguments[i]);
      if (children.length === 1) children = children[0];
      return { __v: true, type: type, props: props || {}, children: children };
    }
  };

  function camelToKebab(s) { return s.replace(/([A-Z])/g, '-$1').toLowerCase(); }

  function styleToText(obj) {
    var out = '';
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      var v = obj[k];
      if (v == null) continue;
      out += camelToKebab(k) + ':' + v + ';';
    }
    return out;
  }

  function flat(x, acc) {
    acc = acc || [];
    if (x == null || x === false || x === true) return acc;
    if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) flat(x[i], acc); return acc; }
    acc.push(x);
    return acc;
  }

  // render a React vnode (or string / DOM node) to a real DOM node
  function renderVNode(v) {
    if (v == null || v === false || v === true) return document.createTextNode('');
    if (typeof v === 'string' || typeof v === 'number') return document.createTextNode(String(v));
    if (v.nodeType) return v; // already a DOM node
    if (!v.__v) return document.createTextNode(String(v));
    var isSvg = !!SVG_TAGS[v.type];
    var el = isSvg ? document.createElementNS(SVG_NS, v.type) : document.createElement(v.type);
    var p = v.props || {};
    for (var key in p) {
      if (!Object.prototype.hasOwnProperty.call(p, key)) continue;
      if (key === 'children' || key === 'key' || key === 'ref') continue;
      var val = p[key];
      if (key === 'style' && val && typeof val === 'object') { el.setAttribute('style', styleToText(val)); continue; }
      if (key.slice(0, 2) === 'on' && typeof val === 'function') { el.addEventListener(key.slice(2).toLowerCase(), val); continue; }
      var name = ATTR_MAP[key] || (key === 'viewBox' || key === 'preserveAspectRatio' ? key : (/[A-Z]/.test(key) && isSvg ? camelToKebab(key) : key));
      if (val != null && val !== false) el.setAttribute(name, val === true ? '' : val);
    }
    var kids = flat(v.children);
    for (var j = 0; j < kids.length; j++) el.appendChild(renderVNode(kids[j]));
    return el;
  }

  function isRenderable(x) { return x && (x.__v || x.nodeType); }

  function resolve(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    var cur = scope[parts[0]];
    for (var i = 1; i < parts.length && cur != null; i++) cur = cur[parts[i]];
    return cur;
  }

  var TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;
  var SINGLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function interpolate(str, scope) {
    return str.replace(TOKEN, function (_, expr) {
      var v = resolve(expr, scope);
      return v == null ? '' : String(v);
    });
  }

  // render one template node into `parent` given `scope`
  function renderNode(node, scope, parent) {
    if (node.nodeType === 3) { // text
      var raw = node.nodeValue;
      if (raw.indexOf('{{') === -1) { parent.appendChild(document.createTextNode(raw)); return; }
      var m = raw.match(SINGLE);
      if (m) {
        var val = resolve(m[1], scope);
        if (isRenderable(val)) { parent.appendChild(renderVNode(val)); return; }
      }
      parent.appendChild(document.createTextNode(interpolate(raw, scope)));
      return;
    }
    if (node.nodeType !== 1) return; // ignore comments etc.

    var tag = node.tagName.toLowerCase();
    if (tag === 'helmet') return; // styles already hoisted at mount

    if (tag === 'sc-if') {
      var cond = node.getAttribute('value') || '';
      var cm = cond.match(SINGLE);
      var truthy = cm ? resolve(cm[1], scope) : interpolate(cond, scope);
      if (truthy) renderChildren(node, scope, parent);
      return;
    }

    if (tag === 'sc-for') {
      var listExpr = (node.getAttribute('list') || '').match(SINGLE);
      var list = listExpr ? resolve(listExpr[1], scope) : [];
      var alias = node.getAttribute('as');
      if (Array.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
          var child = {};
          for (var k in scope) child[k] = scope[k];
          child[alias] = list[i];
          renderChildren(node, child, parent);
        }
      }
      return;
    }

    // regular element
    var el = document.createElement(tag);
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var an = attrs[a].name, av = attrs[a].value;
      if (an.indexOf('hint-') === 0 || an === 'as') continue;
      if (an.slice(0, 2) === 'on') {
        var fm = av.match(SINGLE);
        if (fm) { var fn = resolve(fm[1], scope); if (typeof fn === 'function') el.addEventListener(an.slice(2).toLowerCase(), fn); continue; }
      }
      var ival = interpolate(av, scope);
      if (an === 'value') { el.value = ival; el.setAttribute('value', ival); }
      else el.setAttribute(an, ival);
    }
    renderChildren(node, scope, el);
    parent.appendChild(el);
  }

  function renderChildren(node, scope, parent) {
    var cn = node.childNodes;
    for (var i = 0; i < cn.length; i++) renderNode(cn[i], scope, parent);
  }

  // ---- DCLogic base ----
  function DCLogic() {}
  DCLogic.prototype.setState = function (updater) {
    var next = typeof updater === 'function' ? updater(this.state) : updater;
    var merged = {};
    for (var k in this.state) merged[k] = this.state[k];
    for (var k2 in next) merged[k2] = next[k2];
    this.state = merged;
    this.__render();
  };
  DCLogic.prototype.__render = function () {
    if (!this.__mount) return;
    // preserve focus/caret of a text input across full re-render
    var active = document.activeElement;
    var focusInput = active && active.tagName === 'INPUT' && this.__mount.contains(active);
    var caret = focusInput ? active.selectionStart : null;

    var vals = this.renderVals();
    var frag = document.createDocumentFragment();
    renderChildren(this.__template, vals, frag);
    this.__mount.textContent = '';
    this.__mount.appendChild(frag);

    if (focusInput) {
      var ni = this.__mount.querySelector('input');
      if (ni) { ni.focus(); try { var pos = caret == null ? ni.value.length : caret; ni.setSelectionRange(pos, pos); } catch (e) {} }
    }
  };

  window.React = React;
  window.DCLogic = DCLogic;

  // ---- boot ----
  function boot() {
    var host = document.querySelector('x-dc');
    if (!host) return;

    // hoist <style> from <helmet> into <head> so classes/keyframes apply
    var helmet = host.querySelector('helmet');
    if (helmet) {
      var styles = helmet.querySelectorAll('style');
      for (var i = 0; i < styles.length; i++) document.head.appendChild(styles[i].cloneNode(true));
      var links = helmet.querySelectorAll('link');
      for (var j = 0; j < links.length; j++) document.head.appendChild(links[j].cloneNode(true));
    }

    var template = host.cloneNode(true); // capture pristine template

    var scriptEl = document.querySelector('script[type="text/x-dc"]');
    if (!scriptEl) return;
    var Component;
    // eval the component definition; it declares `class Component extends DCLogic`
    (function () {
      var DCLogic = window.DCLogic, React = window.React;
      Component = eval('(function(){' + scriptEl.textContent + '\nreturn Component;})()');
    })();

    var inst = new Component();
    inst.__mount = host;
    inst.__template = template;
    inst.__render();
    if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
    window.addEventListener('beforeunload', function () { if (typeof inst.componentWillUnmount === 'function') inst.componentWillUnmount(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
