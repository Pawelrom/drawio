(function () {
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

    function onPageChange()
    {
        clearHighlights();
        if (window.App && window.App.main && window.App.main.editor)
        {
            graph = window.App.main.editor.graph;
            graph.getSelectionModel().addListener(mxEvent.CHANGE, onSelectionChange);
        }
    }

    function init()
    {
        graph = window.App.main.editor.graph;
        graph.getSelectionModel().addListener(mxEvent.CHANGE, onSelectionChange);

        // Page change event name to verify in DevTools if needed (see plan Task 3 Krok 4)
        if (window.App.main.addListener)
        {
            window.App.main.addListener('pageSelected', onPageChange);
        }
    }

    function waitForApp()
    {
        if (window.App && window.App.main &&
            window.App.main.editor && window.App.main.editor.graph)
        {
            init();
        }
        else
        {
            requestAnimationFrame(waitForApp);
        }
    }

    window.addEventListener('load', waitForApp);
})();
