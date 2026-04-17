(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ChartGo = factory();
  }
})(this, function () {
  // Define ChartGo without requiring GoJS yet; validate only when init() is called.
  function ensureGo() {
    if (!window.go || !go.GraphObject || !go.Diagram) {
      throw new Error("GoJS (go.js) must be loaded before calling ChartGo.init(...)");
    }
  }

  /**
   * Initialize a vertical tree diagram.
   * @param {string|HTMLElement} container - container id or element
   * @param {object} opts
   *  - treeJson: string (JSON array) OR treeData: array
   *  - callbackUrl: string (Wicket Ajax callback URL) [optional]
   *  - onChange(json, diagram): function [optional] (called after each transaction)
   *  - levelColors: string[] [optional] per depth color override
   *  - wheelZoom: boolean [default true]
   */
  function init(container, opts) {
    ensureGo();
    opts = opts || {};

    var host = (typeof container === "string") ? document.getElementById(container) : container;
    if (!host) throw new Error("ChartGo.init: container not found: " + container);

    var levelColors = Array.isArray(opts.levelColors) ? opts.levelColors.slice() : null;
    function levelColor(level) {
      if (levelColors && levelColors[level]) return levelColors[level];
      switch (level) {
        case 0: return "#C84C4C";   // root: red
        case 1: return "#6F52B5";   // purple
        case 2: return "#36A9C5";   // teal
        case 3: return "#F2994A";   // orange
        default: return "#E3E8EF";  // light gray-blue
      }
    }
    function levelTextColor(level) { return (level <= 1) ? "white" : "#0f172a"; }

    var $ = go.GraphObject.make;
    var myDiagram = $(go.Diagram, host, {
      layout: $(go.TreeLayout, { angle: 90, layerSpacing: 60, nodeSpacing: 24 }),
      "undoManager.isEnabled": true
    });
    if (opts.wheelZoom !== false) {
      myDiagram.toolManager.mouseWheelBehavior = go.ToolManager.WheelZoom;
    }
    myDiagram.commandHandler.deletesTree = true;

    // Node template
    myDiagram.nodeTemplate =
        $(go.Node, "Auto",
            { fromSpot: go.Spot.Bottom, toSpot: go.Spot.Top },
            new go.Binding("movable", "fixed", function (f) { return !f; }),
            new go.Binding("deletable", "fixed", function (f) { return !f; }),
            $(go.Shape, "RoundedRectangle", { stroke: null, strokeWidth: 0, portId: "" },
                new go.Binding("fill", "", function (d, obj) { return levelColor(obj.part.findTreeLevel()); })
            ),
            $(go.TextBlock,
                { margin: 8, editable: true, isMultiline: false, wrap: go.TextBlock.None, font: "bold 14px system-ui" },
                new go.Binding("editable", "fixed", function (f) { return !f; }),
                new go.Binding("stroke", "", function (d, obj) { return levelTextColor(obj.part.findTreeLevel()); }),
                new go.Binding("text").makeTwoWay()
            )
        );

    // Link template: color follows child level
    myDiagram.linkTemplate =
        $(go.Link, { routing: go.Link.Orthogonal, corner: 6 },
            $(go.Shape, { name: "LINKSHAPE", strokeWidth: 2 },
                new go.Binding("stroke", "", function (d, obj) {
                  var to = obj.part && obj.part.toNode;
                  var level = to ? to.findTreeLevel() : 0;
                  return levelColor(level);
                })
            ),
            $(go.Shape, { name: "ARROWSHAPE", toArrow: "OpenTriangle" },
                new go.Binding("stroke", "", function (d, obj) {
                  var to = obj.part && obj.part.toNode;
                  var level = to ? to.findTreeLevel() : 0;
                  return levelColor(level);
                })
            )
        );

    // Context menu
    function makeButton(text, click, visiblePred) {
      return $("ContextMenuButton", $(go.TextBlock, text), { click: click },
          visiblePred ? new go.Binding("visible", "", visiblePred).ofObject() : {});
    }
    function adornedNode(obj) { return obj.part && obj.part.adornedPart; }
    function isNotFixed(obj) { var n = adornedNode(obj); return n && !n.data.fixed; }

    myDiagram.nodeTemplate.contextMenu =
        $("ContextMenu",
            makeButton("新增子節點", function (e, obj) {
              var n = adornedNode(obj); if (!n) return;
              e.diagram.startTransaction("new child");
              e.diagram.model.addNodeData({ key: "k" + Date.now(), text: "新節點", parent: n.data.key });
              e.diagram.commitTransaction("new child");
            }),
            makeButton("新增同層節點", function (e, obj) {
              var n = adornedNode(obj); if (!n) return;
              var p = n.data.parent || null;
              e.diagram.startTransaction("new sibling");
              e.diagram.model.addNodeData({ key: "k" + Date.now(), text: "新節點", parent: p });
              e.diagram.commitTransaction("new sibling");
            }, isNotFixed),
            makeButton("刪除節點", function (e, obj) {
              var n = adornedNode(obj); if (!n) return;
              e.diagram.startTransaction("delete");
              e.diagram.remove(n);
              e.diagram.commitTransaction("delete");
            }, isNotFixed)
        );

    // Load model
    var data = [];
    if (Array.isArray(opts.treeData)) data = opts.treeData;
    else if (typeof opts.treeJson === "string" && opts.treeJson.trim().length) {
      try { data = JSON.parse(opts.treeJson); } catch (e) { console.error("treeJson parse error", e); }
    }
    myDiagram.model = new go.TreeModel(data);

    // Recolor helper (version-safe)
    function recolor() {
      if (typeof myDiagram.updateAllTargetBindings === "function") {
        myDiagram.updateAllTargetBindings();
      } else {
        myDiagram.nodes.each(function (n) { if (n.updateTargetBindings) n.updateTargetBindings(); });
      }
      myDiagram.links.each(function (l) {
        var to = l.toNode;
        var level = to ? to.findTreeLevel() : 0;
        var color = levelColor(level);
        var path = l.findObject("LINKSHAPE"); if (path) path.stroke = color;
        var arrow = l.findObject("ARROWSHAPE"); if (arrow) arrow.stroke = color;
      });
    }
    myDiagram.addDiagramListener("InitialLayoutCompleted", function () { recolor(); });
    myDiagram.addDiagramListener("LayoutCompleted", function () { recolor(); });

    // Save hook
    function save() {
      var json = myDiagram.model.toJson();
      if (opts.callbackUrl && window.Wicket && Wicket.Ajax && Wicket.Ajax.post) {
        Wicket.Ajax.post({ u: opts.callbackUrl, ep: { json: json } });
      }
      if (typeof opts.onChange === "function") {
        try { opts.onChange(json, myDiagram); } catch (e) { console.error(e); }
      }
    }
    myDiagram.addModelChangedListener(function (evt) {
      if (evt.isTransactionFinished) { recolor(); save(); }
    });

    return myDiagram;
  }

  // Public API
  return { init: init };
});
