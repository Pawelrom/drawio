(function () {

    function xmlNodeToJson(node)
    {
        var obj = {};

        if (node.attributes)
        {
            for (var i = 0; i < node.attributes.length; i++)
            {
                var attr = node.attributes[i];
                obj['@' + attr.name] = attr.value;
            }
        }

        var children = [];

        for (var i = 0; i < node.childNodes.length; i++)
        {
            var child = node.childNodes[i];

            if (child.nodeType === 1)
            {
                var childObj = {};
                childObj[child.nodeName] = xmlNodeToJson(child);
                children.push(childObj);
            }
        }

        if (children.length > 0)
        {
            obj['#children'] = children;
        }

        return obj;
    }

    function getDiagramName()
    {
        try
        {
            var currentFile = window.App.main.getCurrentFile();
            if (currentFile)
            {
                var title = currentFile.getTitle();
                if (title) return title.replace(/\.[^.]+$/, '');
            }
        }
        catch (e) {}
        return 'diagram';
    }

    function getXmlString(allPages)
    {
        try
        {
            if (allPages)
            {
                return mxUtils.getXml(window.App.main.editor.getGraphXml());
            }
            else
            {
                return mxUtils.getXml(window.App.main.editor.graph.getModel());
            }
        }
        catch (e)
        {
            return null;
        }
    }

    function triggerPdfExport()
    {
        try
        {
            window.App.main.exportFile('pdf');
        }
        catch (e)
        {
            try
            {
                var action = window.App.main.actions.get('export');
                if (action) action.funct();
            }
            catch (e2)
            {
                window.electron.sendMessage('exportAll-error',
                    { msg: 'Nie można uruchomić eksportu PDF: ' + e2.message });
            }
        }
    }

    window.electron.registerMsgListener('exportAllToFolder', function (data)
    {
        var allPages = data.allPages;
        var name = getDiagramName();
        var xml = getXmlString(allPages);

        if (!xml)
        {
            window.electron.sendMessage('exportAll-error',
                { msg: 'Brak otwartego diagramu lub nie można odczytać modelu.' });
            return;
        }

        window.electron.sendMessage('exportAll-xml-ready', { xml: xml, name: name });

        try
        {
            var dom = (new DOMParser()).parseFromString(xml, 'text/xml');
            var jsonObj = {};
            jsonObj[dom.documentElement.nodeName] = xmlNodeToJson(dom.documentElement);
            var json = JSON.stringify(jsonObj, null, 2);
            window.electron.sendMessage('exportAll-json-ready', { json: json, name: name });
        }
        catch (e)
        {
            window.electron.sendMessage('exportAll-error',
                { msg: 'Błąd konwersji do JSON: ' + e.message });
            return;
        }

        triggerPdfExport();
    });

})();
