(function ()
{
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

    function getDiagramName(ui)
    {
        try
        {
            var currentFile = ui.getCurrentFile();
            if (currentFile)
            {
                var title = currentFile.getTitle();
                if (title) return title.replace(/\.[^.]+$/, '');
            }
        }
        catch (e) {}
        return 'diagram';
    }

    function getXmlString(ui, allPages)
    {
        try
        {
            if (allPages)
            {
                return ui.getFileData(true);
            }
            else
            {
                return mxUtils.getXml(ui.editor.getGraphXml());
            }
        }
        catch (e) { return null; }
    }

    function triggerPdfExport(ui)
    {
        try
        {
            ui.downloadFile('pdf');
        }
        catch (e)
        {
            try
            {
                var action = ui.actions.get('export');
                if (action) action.funct();
            }
            catch (e2)
            {
                window.electron.sendMessage('exportAll-error', { msg: 'PDF export failed: ' + e2.message });
            }
        }
    }

    function getSvgString(ui)
    {
        try
        {
            var svgEl = ui.editor.graph.getSvg(null, null, null, null, null, null, null, false);
            return new XMLSerializer().serializeToString(svgEl);
        }
        catch (e) { return null; }
    }

    function getImageBase64(ui, mimeType, callback)
    {
        try
        {
            var svgEl = ui.editor.graph.getSvg(null, null, null, null, null, null, null, false);
            var svgString = new XMLSerializer().serializeToString(svgEl);
            var svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            var url = URL.createObjectURL(svgBlob);
            var img = new Image();
            img.onload = function ()
            {
                var canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                var dataUrl = canvas.toDataURL(mimeType, 0.9);
                URL.revokeObjectURL(url);
                callback(dataUrl.split(',')[1]);
            };
            img.onerror = function () { URL.revokeObjectURL(url); callback(null); };
            img.src = url;
        }
        catch (e) { callback(null); }
    }

    window.Draw.loadPlugin(function (ui)
    {
        window.electron.registerMsgListener('exportAllToFolder', function (data)
        {
            var allPages = data.allPages;
            var name = getDiagramName(ui);
            var xml = getXmlString(ui, allPages);
            if (!xml)
            {
                window.electron.sendMessage('exportAll-error', { msg: 'Brak otwartego diagramu lub błąd pobierania XML.' });
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
                window.electron.sendMessage('exportAll-error', { msg: 'Błąd konwersji do JSON: ' + e.message });
                return;
            }
            triggerPdfExport(ui);
        });

        window.electron.registerMsgListener('ext-cmd', function (data)
        {
            if (data.type !== 'export') return;

            var payload = data.payload;
            var formats = payload.formats || [];
            var allPages = payload.allPages || false;
            var imagesMode = payload.imagesMode || 'current';
            var name = getDiagramName(ui);

            var pending = 0;
            var done = false;

            function checkDone()
            {
                if (done) return;
                if (pending === 0)
                {
                    done = true;
                    window.electron.sendMessage('ext-result', {type: 'export-complete'});
                }
            }

            function sendFile(format, data, encoding, filename)
            {
                window.electron.sendMessage('ext-result',
                    {type: 'export-data', format: format, data: data,
                     encoding: encoding, filename: filename});
            }

            // XML
            if (formats.indexOf('xml') !== -1)
            {
                var xml = getXmlString(ui, allPages);
                if (xml) sendFile('xml', xml, 'utf8', name + '.xml');
            }

            // JSON
            if (formats.indexOf('json') !== -1)
            {
                var xmlForJson = getXmlString(ui, allPages);
                if (xmlForJson)
                {
                    try
                    {
                        var dom = (new DOMParser()).parseFromString(xmlForJson, 'text/xml');
                        var jsonObj = {};
                        jsonObj[dom.documentElement.nodeName] = xmlNodeToJson(dom.documentElement);
                        sendFile('json', JSON.stringify(jsonObj, null, 2), 'utf8', name + '.json');
                    }
                    catch (e) {}
                }
            }

            // SVG
            if (formats.indexOf('svg') !== -1)
            {
                var svgStr = getSvgString(ui);
                if (svgStr) sendFile('svg', svgStr, 'utf8', name + '.svg');
            }

            // PNG
            if (formats.indexOf('png') !== -1)
            {
                pending++;
                getImageBase64(ui, 'image/png', function (b64)
                {
                    if (b64) sendFile('png', b64, 'base64', name + '.png');
                    pending--;
                    checkDone();
                });
            }

            // JPEG
            if (formats.indexOf('jpeg') !== -1)
            {
                pending++;
                getImageBase64(ui, 'image/jpeg', function (b64)
                {
                    if (b64) sendFile('jpeg', b64, 'base64', name + '.jpeg');
                    pending--;
                    checkDone();
                });
            }

            // PDF i HTML -- natywny dialog
            if (formats.indexOf('pdf') !== -1) triggerPdfExport(ui);
            if (formats.indexOf('html') !== -1) ui.downloadFile('html');

            checkDone(); // jesli brak async formatow
        });
    });
})();
