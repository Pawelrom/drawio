(function ()
{
	function findTopRightChild(cell)
	{
		if (!cell.children || cell.children.length === 0) return null;
		for (var i = 0; i < cell.children.length; i++)
		{
			var child = cell.children[i];
			var style = child.style || '';
			if (style.indexOf('align=right') !== -1 && style.indexOf('verticalAlign=top') !== -1)
			{
				return child;
			}
		}
		return null;
	}

	function getAbsolutePosition(cell, graph)
	{
		var x = (cell.geometry && cell.geometry.x) || 0;
		var y = (cell.geometry && cell.geometry.y) || 0;
		var parent = graph.model.getParent(cell);
		if (parent && graph.isSwimlane(parent))
		{
			x += (parent.geometry && parent.geometry.x) || 0;
			y += (parent.geometry && parent.geometry.y) || 0;
		}
		return {x: x, y: y};
	}

	function downstreamLength(node, visited, graph)
	{
		var count = 0;
		var stack = [node];
		var seen = new Set(Array.from(visited));
		while (stack.length > 0)
		{
			var current = stack.pop();
			if (seen.has(current.id)) continue;
			seen.add(current.id);
			count++;
			var edges = graph.getEdges(current, null, false, true, false) || [];
			for (var i = 0; i < edges.length; i++)
			{
				var t = edges[i].target;
				if (t && !seen.has(t.id) && !graph.isSwimlane(t))
				{
					stack.push(t);
				}
			}
		}
		return count;
	}

	function getConnectedVertices(graph)
	{
		var model = graph.model;
		var cells = model.cells;
		var connected = [];
		for (var id in cells)
		{
			var cell = cells[id];
			if (!cell.isVertex()) continue;
			if (graph.isSwimlane(cell)) continue;
			var outEdges = graph.getEdges(cell, null, false, true, false) || [];
			var inEdges = graph.getEdges(cell, null, true, false, false) || [];
			if (outEdges.length > 0 || inEdges.length > 0)
			{
				connected.push(cell);
			}
		}
		return connected;
	}

	function findRoots(connected, graph)
	{
		var reachable = new Set();
		for (var i = 0; i < connected.length; i++)
		{
			var edges = graph.getEdges(connected[i], null, false, true, false) || [];
			for (var j = 0; j < edges.length; j++)
			{
				var t = edges[j].target;
				if (t) reachable.add(t.id);
			}
		}
		var roots = connected.filter(function (c) { return !reachable.has(c.id); });
		if (roots.length === 0) roots = connected.length > 0 ? [connected[0]] : [];
		roots.sort(function (a, b)
		{
			var posA = getAbsolutePosition(a, graph);
			var posB = getAbsolutePosition(b, graph);
			var sumA = posA.x + posA.y;
			var sumB = posB.x + posB.y;
			if (sumA !== sumB) return sumA - sumB;
			return posA.x - posB.x;
		});
		return roots;
	}

	function clearExistingNumbers(graph)
	{
		var model = graph.model;
		var cells = model.cells;
		for (var id in cells)
		{
			var cell = cells[id];
			if (!cell.isVertex()) continue;
			var child = findTopRightChild(cell);
			if (child && child.value !== '')
			{
				model.setValue(child, '');
			}
		}
	}

	function numberPage(graph, counter, visited)
	{
		var connected = getConnectedVertices(graph);

		function dfs(node)
		{
			if (visited.has(node.id)) return;
			visited.add(node.id);

			var child = findTopRightChild(node);
			if (child)
			{
				graph.model.setValue(child, String(counter.value));
				counter.value++;
			}

			var edges = graph.getEdges(node, null, false, true, false) || [];
			var neighbors = [];
			for (var i = 0; i < edges.length; i++)
			{
				var t = edges[i].target;
				if (t && !visited.has(t.id) && !graph.isSwimlane(t))
				{
					neighbors.push(t);
				}
			}

			if (neighbors.length >= 2)
			{
				neighbors = neighbors.slice().sort(function (a, b)
				{
					return downstreamLength(b, visited, graph) -
						downstreamLength(a, visited, graph);
				});
			}

			for (var j = 0; j < neighbors.length; j++)
			{
				dfs(neighbors[j]);
			}
		}

		var roots = findRoots(connected, graph);
		for (var r = 0; r < roots.length; r++)
		{
			dfs(roots[r]);
		}

		return connected.length;
	}

	function runNumbering(ui)
	{
		var pages = ui.pages;
		if (!pages || pages.length === 0)
		{
			window.electron.sendMessage('ext-result',
				{type: 'number-status', msg: 'Nie znaleziono elementów do numerowania'});
			return;
		}

		var counter = {value: 1};
		var visited = new Set();
		var totalNumbered = 0;

		for (var i = 0; i < pages.length; i++)
		{
			window.electron.sendMessage('ext-result',
				{type: 'number-progress', current: i + 1, total: pages.length});

			// Try direct page graph access without switching
			var pageGraph = null;
			try
			{
				pageGraph = pages[i].graph || (pages[i].state && pages[i].state.graph);
			}
			catch (e) {}

			if (!pageGraph)
			{
				// Fallback: switch to page
				ui.selectPage(pages[i]);
				pageGraph = ui.editor.graph;
			}

			pageGraph.model.beginUpdate();
			try
			{
				clearExistingNumbers(pageGraph);
				totalNumbered += numberPage(pageGraph, counter, visited);
			}
			finally
			{
				pageGraph.model.endUpdate();
			}
		}

		if (totalNumbered === 0)
		{
			window.electron.sendMessage('ext-result',
				{type: 'number-status', msg: 'Nie znaleziono elementów do numerowania'});
		}
		else
		{
			window.electron.sendMessage('ext-result',
				{type: 'number-done', count: counter.value - 1});
		}
	}

	window.Draw.loadPlugin(function (ui)
	{
		window.electron.registerMsgListener('ext-cmd', function (msg)
		{
			if (msg.type !== 'number') return;
			runNumbering(ui);
		});
	});
})();
