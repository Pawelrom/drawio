(function ()
{
    var HIGHLIGHT_CELL_COLOR = '#FF8000';
    var HIGHLIGHT_EDGE_COLOR = '#FFB366';
    var activeHighlights = [];
    var graph = null;

    function clearHighlights()
    {
        for (var i = 0; i < activeHighlights.length; i++)
        {
            activeHighlights[i].destroy();
        }
        activeHighlights = [];
    }

    function highlightCell(cell, color, strokeWidth)
    {
        var state = graph.view.getState(cell);
        if (!state) return;
        var h = new mxCellHighlight(graph, color, strokeWidth);
        h.highlight(state);
        activeHighlights.push(h);
    }

    function onSelectionChange()
    {
        clearHighlights();
        var cells = graph.getSelectionCells();
        if (!cells || cells.length === 0) return;

        for (var i = 0; i < cells.length; i++)
        {
            highlightCell(cells[i], HIGHLIGHT_CELL_COLOR, 3);
            var edges = graph.getEdges(cells[i], null, false, true, false);
            if (edges)
            {
                for (var j = 0; j < edges.length; j++)
                {
                    highlightCell(edges[j], HIGHLIGHT_EDGE_COLOR, 2);
                }
            }
        }
    }

    window.Draw.loadPlugin(function (ui)
    {
        graph = ui.editor.graph;
        graph.getSelectionModel().addListener(mxEvent.CHANGE, onSelectionChange);

        ui.editor.addListener('pageSelected', function ()
        {
            clearHighlights();
            if (graph)
            {
                graph.getSelectionModel().removeListener(onSelectionChange);
            }
            graph = ui.editor.graph;
            graph.getSelectionModel().addListener(mxEvent.CHANGE, onSelectionChange);
        });
    });
})();
