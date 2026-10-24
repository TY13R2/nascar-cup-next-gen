"use strict";
/* Small dependency-free SVG chart helpers: line, column, diverging bars, grouped bars.
   Marks: 2px lines, bars no thicker than 24px with a 4px rounded data end, 2px surface ring on dots.
   Every chart has a hover/focus tooltip; the numbers are also available in a table under each chart. */

var Charts = (function () {
  var NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag), k;
    for (k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgText(parent, x, y, text, cls, anchor) {
    var t = svgEl("text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, parent);
    t.textContent = text;
    return t;
  }

  /* ----- tooltip (one shared element; content is built with textContent) ----- */
  var tipEl = null;
  function tipNode() {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); }
    return tipEl;
  }
  function showTip(content, cx, cy) {
    var t = tipNode();
    t.textContent = "";
    t.appendChild(content);
    t.style.display = "block";
    var w = t.offsetWidth, h = t.offsetHeight;
    var x = cx + 14, y = cy + 14;
    if (x + w > window.innerWidth - 8) x = Math.max(8, cx - w - 14);
    if (y + h > window.innerHeight - 8) y = Math.max(8, cy - h - 14);
    t.style.left = x + "px";
    t.style.top = y + "px";
  }
  function hideTip() { if (tipEl) tipEl.style.display = "none"; }

  function tipHead(text) { var d = document.createElement("div"); d.className = "tip-head"; d.textContent = text; return d; }
  function tipRow(color, kind, value, name) {
    var r = document.createElement("div"); r.className = "tip-row";
    var k = document.createElement("span"); k.className = kind === "line" ? "key-line" : "key-box"; k.style.background = color;
    var v = document.createElement("span"); v.className = "tip-val"; v.textContent = value;
    var n = document.createElement("span"); n.className = "tip-name"; n.textContent = name;
    r.appendChild(k); r.appendChild(v); r.appendChild(n);
    return r;
  }
  function tipBox(head, rows, extra) {
    var d = document.createElement("div");
    d.appendChild(tipHead(head));
    rows.forEach(function (r) { d.appendChild(r); });
    (extra || []).forEach(function (line) {
      var p = document.createElement("div"); p.className = "tip-name"; p.textContent = line; d.appendChild(p);
    });
    return d;
  }

  /* ----- layout helpers ----- */
  function legend(items, kind) {
    var ul = document.createElement("ul");
    ul.className = "legend";
    items.forEach(function (s) {
      var li = document.createElement("li");
      var k = document.createElement("span");
      k.className = kind === "line" ? "key-line" : "key-box";
      k.style.background = s.color;
      li.appendChild(k);
      li.appendChild(document.createTextNode(s.name));
      ul.appendChild(li);
    });
    return ul;
  }

  // Draw now and again whenever the container's width changes. Calling mount again replaces the drawing.
  function mount(container, draw) {
    container._draw = draw;
    container._w = 0;
    function run() {
      var w = Math.floor(container.clientWidth);
      if (!w || w === container._w) return;
      container._w = w;
      container._draw(w);
    }
    run();
    if (!container._ro && window.ResizeObserver) {
      container._ro = new ResizeObserver(run);
      container._ro.observe(container);
    }
  }

  function niceScale(min, max, target) {
    if (min === max) max = min + 1;
    var raw = (max - min) / (target || 5), pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
    var lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step, ticks = [], v;
    for (v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { lo: lo, hi: hi, ticks: ticks };
  }

  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }
  function roundedRight(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    return "M" + x + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      "V" + (y + h - r) + "Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) + "H" + x + "Z";
  }
  function roundedLeft(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    return "M" + (x + w) + "," + y + "H" + (x + r) + "Q" + x + "," + y + " " + x + "," + (y + r) +
      "V" + (y + h - r) + "Q" + x + "," + (y + h) + " " + (x + r) + "," + (y + h) + "H" + (x + w) + "Z";
  }

  function newSvg(container, width, height, label) {
    var svg = svgEl("svg", { viewBox: "0 0 " + width + " " + height, width: width, height: height, role: "img", "aria-label": label || "" });
    container.appendChild(svg);
    return svg;
  }
  function empty(container, width, message) {
    var svg = newSvg(container, width, 60, message);
    svgText(svg, width / 2, 34, message, "c-empty", "middle");
  }

  /* ================= line chart =================
     o: {xs:[labels], series:[{name,color,values:[number|null]}], domain?:[lo,hi], height?, yFormat(v), tipFormat(v), ariaLabel} */
  function lineChart(container, o) {
    mount(container, function (width) {
      container.textContent = "";
      var multi = o.series.length > 1;
      if (multi) container.appendChild(legend(o.series, "line"));
      var all = [];
      o.series.forEach(function (s) { s.values.forEach(function (v) { if (typeof v === "number" && isFinite(v)) all.push(v); }); });
      if (!all.length) return empty(container, width, "No results match the current filters.");

      var H = o.height || 260, endLabels = multi && width >= 620;
      var m = { t: 14, r: endLabels ? 128 : 18, b: 30, l: 46 };
      var pw = width - m.l - m.r, ph = H - m.t - m.b, n = o.xs.length;
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = (hi - lo) * 0.12 || 1;
      var sc = o.domain ? niceScale(o.domain[0], o.domain[1]) : niceScale(lo - pad, hi + pad);
      function X(i) { return m.l + pw * (i + 0.5) / n; }
      function Y(v) { return m.t + ph * (1 - (v - sc.lo) / (sc.hi - sc.lo)); }

      var svg = newSvg(container, width, H, o.ariaLabel);
      svg.setAttribute("tabindex", "0");
      sc.ticks.forEach(function (tv) {
        svgEl("line", { x1: m.l, x2: m.l + pw, y1: Y(tv), y2: Y(tv), "class": tv === sc.lo ? "c-axis" : "c-grid" }, svg);
        svgText(svg, m.l - 8, Y(tv) + 4, o.yFormat(tv), "c-tick", "end");
      });
      o.xs.forEach(function (lab, i) { svgText(svg, X(i), H - 8, String(lab), "c-tick", "middle"); });
      var cross = svgEl("line", { y1: m.t, y2: m.t + ph, "class": "c-cross", visibility: "hidden" }, svg);

      var ends = [];
      o.series.forEach(function (s) {
        var seg = [], last = -1;
        function flush() {
          if (seg.length > 1) svgEl("path", { d: "M" + seg.join("L"), fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
          seg = [];
        }
        s.values.forEach(function (v, i) {
          if (typeof v === "number" && isFinite(v)) { seg.push(X(i) + "," + Y(v)); last = i; } else { flush(); }
        });
        flush();
        s.values.forEach(function (v, i) {
          if (typeof v === "number" && isFinite(v)) svgEl("circle", { cx: X(i), cy: Y(v), r: 4.5, fill: s.color, "class": "c-dot" }, svg);
        });
        if (last >= 0) ends.push({ name: s.name, y: Y(s.values[last]), x: X(last) });
      });

      if (endLabels && ends.length) {
        ends.sort(function (a, b) { return a.y - b.y; });
        var crowded = ends.some(function (e, i) { return i > 0 && e.y - ends[i - 1].y < 15; });
        if (!crowded) ends.forEach(function (e) { svgText(svg, e.x + 10, e.y + 4, e.name, "c-label"); });
      }

      var idx = -1;
      function show(i, cx, cy) {
        idx = i;
        cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
        var rows = [];
        o.series.forEach(function (s) {
          var v = s.values[i];
          if (typeof v === "number" && isFinite(v)) rows.push(tipRow(s.color, "line", (o.tipFormat || o.yFormat)(v), s.name));
        });
        showTip(tipBox(String(o.xs[i]), rows), cx, cy);
      }
      function hide() { idx = -1; cross.setAttribute("visibility", "hidden"); hideTip(); }
      var over = svgEl("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: "transparent" }, svg);
      over.addEventListener("pointermove", function (e) {
        var r = svg.getBoundingClientRect();
        var i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - m.l) / pw * n - 0.5)));
        show(i, e.clientX, e.clientY);
      });
      over.addEventListener("pointerleave", hide);
      svg.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var i = idx < 0 ? 0 : Math.max(0, Math.min(n - 1, idx + (e.key === "ArrowRight" ? 1 : -1)));
        var r = svg.getBoundingClientRect();
        show(i, r.left + X(i), r.top + m.t + 8);
      });
      svg.addEventListener("blur", hide);
    });
  }

  /* ================= column chart (single series) =================
     o: {items:[{label,value}], color, domain?:[lo,hi], height?, yFormat(v), tipFormat(v), valueName, labelIdx?:[i], ariaLabel} */
  function columnChart(container, o) {
    mount(container, function (width) {
      container.textContent = "";
      var vals = o.items.map(function (d) { return d.value; }).filter(function (v) { return typeof v === "number" && isFinite(v); });
      if (!vals.length) return empty(container, width, "No results match the current filters.");
      var H = o.height || 240, m = { t: 22, r: 18, b: 30, l: 46 };
      var pw = width - m.l - m.r, ph = H - m.t - m.b, n = o.items.length, band = pw / n;
      var sc = niceScale(o.domain ? o.domain[0] : 0, o.domain ? o.domain[1] : Math.max.apply(null, vals) * 1.08);
      function Y(v) { return m.t + ph * (1 - (v - sc.lo) / (sc.hi - sc.lo)); }
      var svg = newSvg(container, width, H, o.ariaLabel);
      sc.ticks.forEach(function (tv) {
        svgEl("line", { x1: m.l, x2: m.l + pw, y1: Y(tv), y2: Y(tv), "class": tv === sc.lo ? "c-axis" : "c-grid" }, svg);
        svgText(svg, m.l - 8, Y(tv) + 4, o.yFormat(tv), "c-tick", "end");
      });
      var hiI = vals.indexOf(Math.max.apply(null, vals)), loI = vals.indexOf(Math.min.apply(null, vals));
      var labelIdx = o.labelIdx || [o.items.findIndex(function (d) { return d.value === vals[hiI]; }),
                                   o.items.findIndex(function (d) { return d.value === vals[loI]; })];
      var bw = Math.min(24, band * 0.55);
      o.items.forEach(function (d, i) {
        if (typeof d.value !== "number" || !isFinite(d.value)) return;
        var cx = m.l + band * (i + 0.5), top = Y(d.value), h = Y(sc.lo) - top;
        var g = svgEl("g", { "class": "c-bar", tabindex: 0, "aria-label": d.label + ": " + (o.tipFormat || o.yFormat)(d.value) }, svg);
        svgEl("path", { d: roundedTop(cx - bw / 2, top, bw, h, 4), fill: o.color, "class": "mark" }, g);
        svgEl("rect", { x: cx - band / 2, y: m.t, width: band, height: ph, fill: "transparent" }, g);
        var tip = function (cxp, cyp) {
          showTip(tipBox(String(d.label), [tipRow(o.color, "box", (o.tipFormat || o.yFormat)(d.value), o.valueName || "")], d.extra), cxp, cyp);
        };
        g.addEventListener("pointermove", function (e) { tip(e.clientX, e.clientY); });
        g.addEventListener("pointerleave", hideTip);
        g.addEventListener("focus", function () { var r = g.getBoundingClientRect(); tip(r.left + r.width / 2, r.top); });
        g.addEventListener("blur", hideTip);
        if (labelIdx.indexOf(i) >= 0) svgText(svg, cx, top - 6, (o.tipFormat || o.yFormat)(d.value), "c-label", "middle");
        svgText(svg, cx, H - 8, String(d.label), "c-tick", "middle");
      });
    });
  }

  /* ================= shared row layout for horizontal bars ================= */
  function rowLayout(width) {
    var narrow = width < 520;
    return { l: narrow ? 108 : 150, r: 18, t: 6, b: 28 };
  }

  /* ================= diverging horizontal bars =================
     o: {items:[{label, flag, value, head, extra:[lines]}], fmt(v), posName, negName, valueNameFor(v), ariaLabel} */
  function divergingBars(container, o) {
    mount(container, function (width) {
      container.textContent = "";
      if (!o.items.length) return empty(container, width, o.emptyMessage || "No results match the current filters.");
      var pos = "var(--div-pos)", neg = "var(--div-neg)";
      container.appendChild(legend([{ name: o.posName, color: pos }, { name: o.negName, color: neg }], "box"));
      var m = rowLayout(width), rowH = 30, bar = 20, n = o.items.length;
      var H = m.t + rowH * n + m.b, pw = width - m.l - m.r;
      var maxAbs = Math.max.apply(null, o.items.map(function (d) { return Math.abs(d.value); })) || 1;
      var room = 46, grow = (pw / 2) / Math.max(pw / 2 - room, 20);   // keep room beside the longest bar for its value label
      var sc = niceScale(-maxAbs * grow, maxAbs * grow, 6), half = Math.max(Math.abs(sc.lo), Math.abs(sc.hi));
      function X(v) { return m.l + pw * (v + half) / (2 * half); }
      var svg = newSvg(container, width, H, o.ariaLabel);
      sc.ticks.forEach(function (tv) {
        if (Math.abs(tv) > half + 1e-9) return;
        svgEl("line", { x1: X(tv), x2: X(tv), y1: m.t, y2: m.t + rowH * n, "class": tv === 0 ? "c-axis" : "c-grid" }, svg);
        svgText(svg, X(tv), H - 8, (o.tickFmt || o.fmt)(tv), "c-tick", "middle");
      });
      o.items.forEach(function (d, i) {
        var y = m.t + rowH * i + (rowH - bar) / 2, x0 = X(0), x1 = X(d.value), w = Math.max(Math.abs(x1 - x0), 1);
        var g = svgEl("g", { "class": "c-bar", tabindex: 0, "aria-label": d.label + (d.flag ? " " + d.flag : "") + ": " + o.fmt(d.value) }, svg);
        var color = d.value >= 0 ? pos : neg;
        svgEl("path", { d: d.value >= 0 ? roundedRight(x0, y, w, bar, 4) : roundedLeft(x0 - w, y, w, bar, 4), fill: color, "class": "mark" }, g);
        svgEl("rect", { x: 0, y: m.t + rowH * i, width: width, height: rowH, fill: "transparent" }, g);
        svgText(svg, m.l - 10, y + bar / 2 + 4, d.label + (d.flag ? " " + d.flag : ""), "c-cat", "end");
        if (d.value >= 0) svgText(svg, x1 + 6, y + bar / 2 + 4, o.fmt(d.value), "c-label");
        else svgText(svg, x1 - 6, y + bar / 2 + 4, o.fmt(d.value), "c-label", "end");
        var tip = function (cx, cy) {
          showTip(tipBox(d.head || d.label, [tipRow(color, "box", o.fmt(d.value), o.valueNameFor(d.value))], d.extra), cx, cy);
        };
        g.addEventListener("pointermove", function (e) { tip(e.clientX, e.clientY); });
        g.addEventListener("pointerleave", hideTip);
        g.addEventListener("focus", function () { var r = g.getBoundingClientRect(); tip(r.left + r.width / 2, r.top); });
        g.addEventListener("blur", hideTip);
      });
    });
  }

  /* ================= grouped horizontal bars (two series) =================
     o: {items:[{label, head, values:[a|null, b|null], extra}], series:[{name,color}], domainMax, fmt(v), ariaLabel} */
  function groupedBars(container, o) {
    mount(container, function (width) {
      container.textContent = "";
      if (!o.items.length) return empty(container, width, "No results match the current filters.");
      container.appendChild(legend(o.series, "box"));
      var m = rowLayout(width), rowH = 36, bar = 12, gap = 2, n = o.items.length;
      var H = m.t + rowH * n + m.b, pw = width - m.l - m.r;
      var sc = niceScale(0, o.domainMax * 1.05, 5);
      function X(v) { return m.l + pw * (v - sc.lo) / (sc.hi - sc.lo); }
      var svg = newSvg(container, width, H, o.ariaLabel);
      sc.ticks.forEach(function (tv) {
        svgEl("line", { x1: X(tv), x2: X(tv), y1: m.t, y2: m.t + rowH * n, "class": tv === sc.lo ? "c-axis" : "c-grid" }, svg);
        svgText(svg, X(tv), H - 8, (o.tickFmt || o.fmt)(tv), "c-tick", "middle");
      });
      o.items.forEach(function (d, i) {
        var top = m.t + rowH * i, y0 = top + (rowH - (2 * bar + gap)) / 2;
        var g = svgEl("g", { "class": "c-bar", tabindex: 0, "aria-label": d.label + ": " + d.values.map(function (v, k) { return o.series[k].name + " " + (v == null ? "no data" : o.fmt(v)); }).join(", ") }, svg);
        d.values.forEach(function (v, k) {
          if (v == null || !isFinite(v)) return;
          svgEl("path", { d: roundedRight(X(0), y0 + k * (bar + gap), Math.max(X(v) - X(0), 1), bar, 4), fill: o.series[k].color, "class": "mark" }, g);
        });
        svgEl("rect", { x: 0, y: top, width: width, height: rowH, fill: "transparent" }, g);
        svgText(svg, m.l - 10, top + rowH / 2 + 4, d.label, "c-cat", "end");
        var tip = function (cx, cy) {
          var rows = [];
          d.values.forEach(function (v, k) { rows.push(tipRow(o.series[k].color, "box", v == null ? "no data" : o.fmt(v), o.series[k].name)); });
          showTip(tipBox(d.head || d.label, rows, d.extra), cx, cy);
        };
        g.addEventListener("pointermove", function (e) { tip(e.clientX, e.clientY); });
        g.addEventListener("pointerleave", hideTip);
        g.addEventListener("focus", function () { var r = g.getBoundingClientRect(); tip(r.left + r.width / 2, r.top); });
        g.addEventListener("blur", hideTip);
      });
    });
  }

  return { lineChart: lineChart, columnChart: columnChart, divergingBars: divergingBars, groupedBars: groupedBars };
})();
