/* Flot plugin for adding the ability to pan and zoom the plot.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Copyright (c) 2016 Ciprian Ceteras.
Copyright (c) 2017 Raluca Portase.
Licensed under the MIT license.

*/

/**
## jquery.flot.navigate.js

This flot plugin is used for adding the ability to pan and zoom the plot.
A higher level overview is available at [interactions](interactions.md) documentation.

The default behaviour is scrollwheel up/down to zoom in, drag
to pan. The plugin defines plot.zoom({ center }), plot.zoomOut() and
plot.pan( offset ) so you easily can add custom controls. It also fires
"plotpan" and "plotzoom" events, useful for synchronizing plots.

The plugin supports these options:
```js
    zoom: {
        interactive: false,
        active: false,
        amount: 1.5         // 2 = 200% (zoom in), 0.5 = 50% (zoom out)
    }

    pan: {
        interactive: false,
        active: false,
        cursor: "move",     // CSS mouse cursor value used when dragging, e.g. "pointer"
        frameRate: 60,
        mode: "smart"       // enable smart pan mode
    }

    xaxis: {
        axisZoom: true, //zoom axis when mouse over it is allowed
        plotZoom: true, //zoom axis is allowed for plot zoom
        axisPan: true, //pan axis when mouse over it is allowed
        plotPan: true, //pan axis is allowed for plot pan
        panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
        zoomRange: [undefined, undefined], // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
    }

    yaxis: {
        axisZoom: true, //zoom axis when mouse over it is allowed
        plotZoom: true, //zoom axis is allowed for plot zoom
        axisPan: true, //pan axis when mouse over it is allowed
        plotPan: true //pan axis is allowed for plot pan
        panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
        zoomRange: [undefined, undefined], // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
    }
```
**interactive** enables the built-in drag/click behaviour. If you enable
interactive for pan, then you'll have a basic plot that supports moving
around; the same for zoom.

**active** is true after a touch tap on plot. This enables plot navigation.
Once activated, zoom and pan cannot be deactivated. When the plot becomes active,
"plotactivated" event is triggered.

**amount** specifies the default amount to zoom in (so 1.5 = 150%) relative to
the current viewport.

**cursor** is a standard CSS mouse cursor string used for visual feedback to the
user when dragging.

**frameRate** specifies the maximum number of times per second the plot will
update itself while the user is panning around on it (set to null to disable
intermediate pans, the plot will then not update until the mouse button is
released).

**mode** a string specifies the pan mode for mouse interaction. Accepted values:
'manual': no pan hint or direction snapping;
'smart': The graph shows pan hint bar and the pan movement will snap
to one direction when the drag direction is close to it;
'smartLock'. The graph shows pan hint bar and the pan movement will always
snap to a direction that the drag diorection started with.

Example API usage:
```js
    plot = $.plot(...);

    // zoom default amount in on the pixel ( 10, 20 )
    plot.zoom({ center: { left: 10, top: 20 } });

    // zoom out again
    plot.zoomOut({ center: { left: 10, top: 20 } });

    // zoom 200% in on the pixel (10, 20)
    plot.zoom({ amount: 2, center: { left: 10, top: 20 } });

    // pan 100 pixels to the left (changing x-range in a positive way) and 20 down
    plot.pan({ left: -100, top: 20 })
```

Here, "center" specifies where the center of the zooming should happen. Note
that this is defined in pixel space, not the space of the data points (you can
use the p2c helpers on the axes in Flot to help you convert between these).

**amount** is the amount to zoom the viewport relative to the current range, so
1 is 100% (i.e. no change), 1.5 is 150% (zoom in), 0.7 is 70% (zoom out). You
can set the default in the options.
*/

/* eslint-enable */
(function($) {
    'use strict';

    var options = {
        zoom: {
            interactive: false,
            active: false,
            amount: 1.5 // how much to zoom relative to current position, 2 = 200% (zoom in), 0.5 = 50% (zoom out)
        },
        pan: {
            interactive: false,
            active: false,
            cursor: "move",
            frameRate: 60,
            mode: 'smart'
        },
        recenter: {
            interactive: true
        },
        xaxis: {
            axisZoom: true, //zoom axis when mouse over it is allowed
            plotZoom: true, //zoom axis is allowed for plot zoom
            axisPan: true, //pan axis when mouse over it is allowed
            plotPan: true, //pan axis is allowed for plot pan
            panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
            zoomRange: [undefined, undefined] // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
        },
        yaxis: {
            axisZoom: true,
            plotZoom: true,
            axisPan: true,
            plotPan: true,
            panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
            zoomRange: [undefined, undefined] // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
        }
    };

    var saturated = $.plot.saturated;
    var browser = $.plot.browser;
    var SNAPPING_CONSTANT = $.plot.uiConstants.SNAPPING_CONSTANT;
    var PANHINT_LENGTH_CONSTANT = $.plot.uiConstants.PANHINT_LENGTH_CONSTANT;

    function init(plot) {
        plot.hooks.processOptions.push(initNevigation);
    }

    function initNevigation(plot, options) {
        var panAxes = null;
        var canDrag = false;
        var useManualPan = options.pan.mode === 'manual',
            smartPanLock = options.pan.mode === 'smartLock',
            useSmartPan = smartPanLock || options.pan.mode === 'smart';

        function onZoomClick(e, zoomOut, amount) {
            var page = browser.getPageXY(e);

            var c = plot.offset();
            c.left = page.X - c.left;
            c.top = page.Y - c.top;

            var ec = plot.getPlaceholder().offset();
            ec.left = page.X - ec.left;
            ec.top = page.Y - ec.top;

            var axes = plot.getXAxes().concat(plot.getYAxes()).filter(function (axis) {
                var box = axis.box;
                if (box !== undefined) {
                    return (ec.left > box.left) && (ec.left < box.left + box.width) &&
                        (ec.top > box.top) && (ec.top < box.top + box.height);
                }
            });

            if (axes.length === 0) {
                axes = undefined;
            }

            if (zoomOut) {
                plot.zoomOut({
                    center: c,
                    axes: axes,
                    amount: amount
                });
            } else {
                plot.zoom({
                    center: c,
                    axes: axes,
                    amount: amount
                });
            }
        }

        var prevCursor = 'default',
            panHint = null,
            panTimeout = null,
            plotState,
            prevDragPosition = { x: 0, y: 0 },
            isPanAction = false;

        function onMouseWheel(e, delta) {
            var maxAbsoluteDeltaOnMac = 1,
                isMacScroll = Math.abs(e.originalEvent.deltaY) <= maxAbsoluteDeltaOnMac,
                defaultNonMacScrollAmount = null,
                macMagicRatio = 50,
                amount = isMacScroll ? 1 + Math.abs(e.originalEvent.deltaY) / macMagicRatio : defaultNonMacScrollAmount;

            if (isPanAction) {
                onDragEnd(e);
            }

            if (plot.getOptions().zoom.active) {
                e.preventDefault();
                onZoomClick(e, delta < 0, amount);
                return false;
            }
        }

        plot.navigationState = function(startPageX, startPageY) {
            var axes = this.getAxes();
            var result = {};
            Object.keys(axes).forEach(function(axisName) {
                var axis = axes[axisName];
                result[axisName] = {
                    navigationOffset: { below: axis.options.offset.below || 0,
                        above: axis.options.offset.above || 0},
                    axisMin: axis.min,
                    axisMax: axis.max,
                    diagMode: false
                }
            });

            result.startPageX = startPageX || 0;
            result.startPageY = startPageY || 0;
            return result;
        }

        function onMouseDown(e) {
            canDrag = true;
        }

        function onMouseUp(e) {
            canDrag = false;
        }

        function isLeftMouseButtonPressed(e) {
            return e.button === 0;
        }

        function onDragStart(e) {
            if (!canDrag || !isLeftMouseButtonPressed(e)) {
                return false;
            }

            isPanAction = true;
            var page = browser.getPageXY(e);

            var ec = plot.getPlaceholder().offset();
            ec.left = page.X - ec.left;
            ec.top = page.Y - ec.top;

            panAxes = plot.getXAxes().concat(plot.getYAxes()).filter(function (axis) {
                var box = axis.box;
                if (box !== undefined) {
                    return (ec.left > box.left) && (ec.left < box.left + box.width) &&
                        (ec.top > box.top) && (ec.top < box.top + box.height);
                }
            });

            if (panAxes.length === 0) {
                panAxes = undefined;
            }

            var c = plot.getPlaceholder().css('cursor');
            if (c) {
                prevCursor = c;
            }

            plot.getPlaceholder().css('cursor', plot.getOptions().pan.cursor);

            if (useSmartPan) {
                plotState = plot.navigationState(page.X, page.Y);
            } else if (useManualPan) {
                prevDragPosition.x = page.X;
                prevDragPosition.y = page.Y;
            }
        }

        function onDrag(e) {
            if (!isPanAction) {
                return;
            }

            var page = browser.getPageXY(e);
            var frameRate = plot.getOptions().pan.frameRate;

            if (frameRate === -1) {
                if (useSmartPan) {
                    plot.smartPan({
                        x: plotState.startPageX - page.X,
                        y: plotState.startPageY - page.Y
                    }, plotState, panAxes, false, smartPanLock);
                } else if (useManualPan) {
                    plot.pan({
                        left: prevDragPosition.x - page.X,
                        top: prevDragPosition.y - page.Y,
                        axes: panAxes
                    });
                    prevDragPosition.x = page.X;
                    prevDragPosition.y = page.Y;
                }
                return;
            }

            if (panTimeout || !frameRate) return;

            panTimeout = setTimeout(function() {
                if (useSmartPan) {
                    plot.smartPan({
                        x: plotState.startPageX - page.X,
                        y: plotState.startPageY - page.Y
                    }, plotState, panAxes, false, smartPanLock);
                } else if (useManualPan) {
                    plot.pan({
                        left: prevDragPosition.x - page.X,
                        top: prevDragPosition.y - page.Y,
                        axes: panAxes
                    });
                    prevDragPosition.x = page.X;
                    prevDragPosition.y = page.Y;
                }

                panTimeout = null;
            }, 1 / frameRate * 1000);
        }

        function onDragEnd(e) {
            if (!isPanAction) {
                return;
            }

            if (panTimeout) {
                clearTimeout(panTimeout);
                panTimeout = null;
            }

            isPanAction = false;
            var page = browser.getPageXY(e);

            plot.getPlaceholder().css('cursor', prevCursor);

            if (useSmartPan) {
                plot.smartPan({
                    x: plotState.startPageX - page.X,
                    y: plotState.startPageY - page.Y
                }, plotState, panAxes, false, smartPanLock);
                plot.smartPan.end();
            } else if (useManualPan) {
                plot.pan({
                    left: prevDragPosition.x - page.X,
                    top: prevDragPosition.y - page.Y,
                    axes: panAxes
                });
                prevDragPosition.x = 0;
                prevDragPosition.y = 0;
            }
        }

        function onDblClick(e) {
            plot.activate();
            var o = plot.getOptions()

            if (!o.recenter.interactive) { return; }

            var axes = plot.getTouchedAxis(e.clientX, e.clientY),
                event;

            plot.recenter({ axes: axes[0] ? axes : null });

            if (axes[0]) {
                event = new $.Event('re-center', { detail: {
                    axisTouched: axes[0]
                }});
            } else {
                event = new $.Event('re-center', { detail: e });
            }
            plot.getPlaceholder().trigger(event);
        }

        function onClick(e) {
            plot.activate();

            if (isPanAction) {
                onDragEnd(e);
            }

            return false;
        }

        plot.activate = function() {
            var o = plot.getOptions();
            if (!o.pan.active || !o.zoom.active) {
                o.pan.active = true;
                o.zoom.active = true;
                plot.getPlaceholder().trigger("plotactivated", [plot]);
            }
        }

        function bindEvents(plot, eventHolder) {
            var o = plot.getOptions();
            if (o.zoom.interactive) {
                eventHolder.mousewheel(onMouseWheel);
            }

            if (o.pan.interactive) {
                plot.addEventHandler("dragstart", onDragStart, eventHolder, 0);
                plot.addEventHandler("drag", onDrag, eventHolder, 0);
                plot.addEventHandler("dragend", onDragEnd, eventHolder, 0);
                eventHolder.bind("mousedown", onMouseDown);
                eventHolder.bind("mouseup", onMouseUp);
            }

            eventHolder.dblclick(onDblClick);
            eventHolder.click(onClick);
        }

        plot.zoomOut = function(args) {
            if (!args) {
                args = {};
            }

            if (!args.amount) {
                args.amount = plot.getOptions().zoom.amount;
            }

            args.amount = 1 / args.amount;
            plot.zoom(args);
        };

        plot.zoom = function(args) {
            if (!args) {
                args = {};
            }

            var c = args.center,
                amount = args.amount || plot.getOptions().zoom.amount,
                w = plot.width(),
                h = plot.height(),
                axes = args.axes || plot.getAxes();

            if (!c) {
                c = {
                    left: w / 2,
                    top: h / 2
                };
            }

            var xf = c.left / w,
                yf = c.top / h,
                minmax = {
                    x: {
                        min: c.left - xf * w / amount,
                        max: c.left + (1 - xf) * w / amount
                    },
                    y: {
                        min: c.top - yf * h / amount,
                        max: c.top + (1 - yf) * h / amount
                    }
                };

            for (var key in axes) {
                if (!axes.hasOwnProperty(key)) {
                    continue;
                }

                var axis = axes[key],
                    opts = axis.options,
                    min = minmax[axis.direction].min,
                    max = minmax[axis.direction].max,
                    navigationOffset = axis.options.offset;

                //skip axis without axisZoom when zooming only on certain axis or axis without plotZoom for zoom on entire plot
                if ((!opts.axisZoom && args.axes) || (!args.axes && !opts.plotZoom)) {
                    continue;
                }

                min = $.plot.saturated.saturate(axis.c2p(min));
                max = $.plot.saturated.saturate(axis.c2p(max));
                if (min > max) {
                    // make sure min < max
                    var tmp = min;
                    min = max;
                    max = tmp;
                }

                // test for zoom limits zoomRange: [min,max]
                if (opts.zoomRange) {
                    // zoomed in too far
                    if (max - min < opts.zoomRange[0]) {
                        continue;
                    }
                    // zoomed out to far
                    if (max - min > opts.zoomRange[1]) {
                        continue;
                    }
                }

                var offsetBelow = $.plot.saturated.saturate(navigationOffset.below - (axis.min - min));
                var offsetAbove = $.plot.saturated.saturate(navigationOffset.above - (axis.max - max));
                opts.offset = { below: offsetBelow, above: offsetAbove };
            };

            plot.setupGrid(true);
            plot.draw();

            if (!args.preventEvent) {
                plot.getPlaceholder().trigger("plotzoom", [plot, args]);
            }
        };

        plot.pan = function(args) {
            var delta = {
                x: +args.left,
                y: +args.top
            };

            if (isNaN(delta.x)) delta.x = 0;
            if (isNaN(delta.y)) delta.y = 0;

            $.each(args.axes || plot.getAxes(), function(_, axis) {
                var opts = axis.options,
                    d = delta[axis.direction];

                //skip axis without axisPan when panning only on certain axis or axis without plotPan for pan the entire plot
                if ((!opts.axisPan && args.axes) || (!opts.plotPan && !args.axes)) {
                    return;
                }

                // calc min delta (revealing left edge of plot)
                var minD = axis.p2c(opts.panRange[0]) - axis.p2c(axis.min);
                // calc max delta (revealing right edge of plot)
                var maxD = axis.p2c(opts.panRange[1]) - axis.p2c(axis.max);
                // limit delta to min or max if enabled
                if (opts.panRange[0] !== undefined && d >= maxD) d = maxD;
                if (opts.panRange[1] !== undefined && d <= minD) d = minD;

                if (d !== 0) {
                    var navigationOffsetBelow = saturated.saturate(axis.c2p(axis.p2c(axis.min) + d) - axis.c2p(axis.p2c(axis.min))),
                        navigationOffsetAbove = saturated.saturate(axis.c2p(axis.p2c(axis.max) + d) - axis.c2p(axis.p2c(axis.max)));

                    if (!isFinite(navigationOffsetBelow)) {
                        navigationOffsetBelow = 0;
                    }

                    if (!isFinite(navigationOffsetAbove)) {
                        navigationOffsetAbove = 0;
                    }

                    opts.offset = {
                        below: saturated.saturate(navigationOffsetBelow + (opts.offset.below || 0)),
                        above: saturated.saturate(navigationOffsetAbove + (opts.offset.above || 0))
                    };
                }
            });

            plot.setupGrid(true);
            plot.draw();
            if (!args.preventEvent) {
                plot.getPlaceholder().trigger("plotpan", [plot, args]);
            }
        };

        plot.recenter = function(args) {
            $.each(args.axes || plot.getAxes(), function(_, axis) {
                if (args.axes) {
                    if (this.direction === 'x') {
                        axis.options.offset = { below: 0 };
                    } else if (this.direction === 'y') {
                        axis.options.offset = { above: 0 };
                    }
             ›Ð‚ê3 éâœ˜šÈ\f BþW˜´5ÁŸßmï+¥@œ ¬6[´¶ÏÚ@o«ú*=om ïŸ<‘ìk®æ íˆ$W3ÜÐøomèm ¬ŸÄÁ¥MªÚ ã.Ô²î¯¦¢ùomèk4ð N‘™­°ñÛ 8v§,‹¼«omèaµ4} åËjKQo (Ï;ÊŸlm è~‘¿>¡À \À¢Ž¤Ù\~ïÖPÂßmèz ¼Ë¶ë‚bYB "ÒI0è`ÕŸ°ÕR	ºlml  Olly lmè/4; â<<=X’QÀvU…Rè	˜)|W"ÃZj ¾¶ð¿B2êBæ_L$Ô` ï¥µ5&ˆ§ ôö+WL”ñL&G,;Þ”Ç TÆ‡Ôw#Síþ“gÊ&'ËŒ 1toÀç>n ëÆ:6Š+8±&>›ŽËæÖw &&H¯f´C.&kN­&6§ ›ÀÏÎ6/ ×'¹øÑ˜QŒùfa“m< ôIC@ò¾± ’M7Bèó) ùnµ1Ìëê¯@7˜ü}(P‘&7 ä>Eaý®ç© ¼8zÖ 3ËÎ0;A/G |‘éM[@²SCúRe  	$\iE|w 0‰¸Ùdƒ¨ j  ÀF!K P8fêÇ¹˜M@NJNq’ ÖëB|Y  ë‡P±_…#‘	&MñN Òøbc³Ø@Z¢üªx‘	 ó¿ƒm’

 (V%!„ÎæÆ½‘	è« l=Ðè×gÌ@¢%¯Ià‘	 ÎXRÛq™TJ  K¾‡Sù’	§4Ú¶Å ž4Å.ßƒ ’òÖ‹‘	ìá R¡Ëy¬Tð ¸â¡àû”$ª‘	àî³s c-ZË«ÌÀ]*lÒMáÇ: ¢éVƒE• ’®y6ð¼XQâìö›Ü" :³Ü«ƒl·Ñe–ƒ‘	ûÞë eˆýlŒÃÍ ØîRýRûb‘	ñ4O«©
› ]sÕ©Ê_\Ð¦Ì>’	¹ù ”(ÖÆöÃ¾3€Ûüúa4&‘	 óS
ÅQ‡ J@Áü72t=/îÑÉÀÜJ LŽÕT{€|ô›³^'®Ñ ÀúügOÑ›F .½›Á_êÄ ŽÑÒÝÃ LÂé&ñ¶xü€êß~5ªƒÑ Óö“¶¿Ò !¤éÐÎ¾¯j-Ñ¯‡Ö˜ É…;—êsi°€ÈêÙX¥'DÑ ¹¯°7§N_– |·‘$âOÕ­*·4Ñ»JÃh xù¯ïÓ‘€#1v•hÕùÑ µëñZôb¶ ñÿìØâæ	¡|IGÑŠßÃ® á¦+iECj6€îP  Iƒ]Ñ ‹ûZb«#/ ŸukÕ¼µŠç0
Ñ†}­¸ (Æ? †àÕ·@I&°$ôraŸ 	éQuëi¦ Ü1’÷+!©¹Á1±	”k¶<Þ .¼ªÉÍ'Ò Ìæßù,R•# Ç6`Ûˆ K*ÈHw¤…f°	éhº£ÞÏ TFÅàíX ¡m_‹qaéa ™ò¤þ‰½¤Ó Ç2^,;•íØ±	|í5˜ °«õ¶j|ž@Q“%Ñ~ uh<ºiT´ ÉŒ]+¤CAûÑxÆ–^ÿ  Èå£®z@(H˜€L¥Òß ®‰×e€â!Û wð|ÀL¼o8Ñp=%®b ò½	Ÿ,íÉœ{ÞH¢ÓÛg jò(}²Ø@/á‚)qpé J‰/?7cJæ ŸØÛ!‰'ˆv‘ªé^˜Ä× =‘W°¿âv€epÖŠ‡‘q Z‹Ó<Lµ ½³èöÃJHºÑ[·åµ T:´¿ gÇ€!ºW
ÔIRo méTP;–i ÖÌ©@ùªÕ— ƒð¡ù¿omé (»<øÑ3>L î]‰€!#÷ç%omé*Ð <éNïºÏNV žaV6u@sgomé%Þ¤Â ÎûÏ"@‹„`¿Wl mé;Ñ /U µM
ƒ:«èŸ sÓ×Zôßmé 77LZ¬Ô ÛÆXz>”|M³öo`Ð´© Ž²SÆPK©§ÀþÔ˜mGI@ 1Ôá.†1¥“ ³0|:†DÉ†‰ßméí ;³–@õwü <Ü~oK!0IÐ I`Sª JÑ¿bÒ% ðºŽ]«ßmé „×y¤XÞÞ GKŠ×æÜNìéäœoméÿ¼ úž'Žvû¡k †@~Ÿ£(.oméôâÍ c°µ”÷fO€ RjYÑh o méõsÃib— q«¨5YfƒÀ „ßy|^omé ö0®‰G2¦¸ N}$]«½\„8¹oméñÈ ç<h¯QšH Þ*›KD/®+o`‹Ê)8 ƒœ¼›õ‘+‹ `~Iˆ÷omé ÊÞ‰§ãXü2 `èå5+I,Š•ÝoméÁâ ‹P–TìÊ& ê`ØR•µk‚oméØÙ4 ‘xâVÏ &€^ÇHpèÚwo méÓ™µèT‚ Ê>†y›Þ;| øðì!~omé ®ÿ«H9EàU ¬+Ù§øz-”nÜÁomé¹š ½è½ ×³/= ±è(Â 3å¸omé´‡§ ÔÙ‘œü~€,¾õeÎ¼o mé·‹ÌyáB €!¬Î:õ0r7ˆ=ïcð&‰N @†~ük´»s ~Z¿PY¼zßméö±3 ÇˆñáÝØ‚Û€­†·jËyo mêk/6Q˜Z l,êl, ¾ü¬‹domê xˆÍÉ6ÏS +^#K-¦-¤™omêy2 IëÆ~înü ½e–(‡Ç»$omêN	¬ ÎŠ2÷"=‰H€UV‚ôo mêH´Gd* ä§7F?G”DIlmê ^æpAß¹ÙŸ «z÷uç¥–†^?¹`[; ³w>Ôb=¢{€W´WçòTjO mêR H…~á åë“+Õ0ðÕÐ˜OÐ&‘ ®]ä9è0¼A ËÿÎè~§ßmê'~ˆ_ GÛTnÀÅâ¨,…d:Ð "ú…y. è „TÉ{'vë¼m\ßmê9æ Æ0ë‚"÷oÎ ¿l–!¹îÈÊoÐ5ü=âJ /<‚òËÊ80É‚¸U"`6² X€¿ý+¢ ¿¯D_ŸÑ­UÛOmê37ñ rïº(B@í€€P¯ÌŠÕo mêJs; J&7Ýví ŒKš	omê R§)HZ€ [žÅ€vVÜ¦_°	ûš ˆE< )ÏÝ€²6‘ÓÄ^õß mêîŽó M¡:ª™	0ØJ÷½/Ðçk ‰úÒŒÿû  ´=§m‰¯`õ@ë6ê íOqÕ3Ø+0[ÕS¿W`ö× Rê¥è7 Aw:‡êü8òŸ\a¶Þ`6àA ŸŸõ¶’ÙÛàQ/mêÍ SbŠðp~px °¼/+z\ßyÐÈE€¥ šÙ¬Øú[ ^ç€]¦”ºml  Ollyl mêË­³k>Z it·Qý¬ià³:ï¯è	˜ Åt±ñ1ßå l~è‰hèÈÔ
ÑULÇ«Kl úO£Ëq¦€Œ,W´ZšL Ùu›ø	sR¼ ÐY!s·™;
Öÿ&ÑŠ‹ê ‘l•@Që€*Å\5»€¡& Ó“rˆ( [iÁUmïíë€x&®Õc uVÑþs?€~_š™±(† ª1ì÷h{°Û ºk+-îeÚßïÆÃ»X wËµ¡óðTâ€¸,‰Ô) µdG\¤Ýb Ï%"ÅrüØ˜ç×vßÓ äVr‡´u¢@öÃÔ•Œ*° ©r×cX	ßË ÿ¶v™Ådg	]Ö ïnô¯¤—.§@'	æ*I« ¬´Ãÿ0%\L p-ÅŠí¦o™à‘	Š%¨g µT¹ÿ7Ò@›{»K‘	ƒ g€7q©G K“t¨ø#šg´‘	éLˆ! nê/<ru6@••4Ý¶ª‘	š iÓ©ã•!ñU ß@„ŽC‘	ën=:« çÄÆú±‡ï€Œ6ˆÏÉ9Z‘	 hß/ñ\ò°ó }IÜéž_.y™ ‘	f:×< YSèBÐßE†€Gˆ†ó¥†‘	 q«_„=ç !½ãL³M&˜øVÚ‘	r†åz (\Ð9Èœ­@YÙŽûÑtë MÇsÞ=ö aþˆ²ñ&ƒô—·hQEl. =7†¤ÕéC€+Ðþ¡Zeù‘	 FH·„?ÆÏ 7ÉƒLÁ¶&L‰¤‘	@·D› £ðe§^K„€2_êbŒ(TÒ ŽŽÙs\# 0ø‘™Ý%!kÔÑQ³ìù6 oBw6B@¯|ûžÈíÑS ï!4 ÈcñŒ k'ûºßÞ|`¸Ñ.–~E çå”Bž1ü@“=Z!­ÏÑ( j¾Ðokª ?d1~žulñMë"Äà‘ˆ ÏÊ’‚»£Y@ò¿ù‹CÝ±	< {Ÿø°ÆÃ½ ÛÚgÄªð^q³Ñ=¥Ãe" ¦G¶µŠ‡>@†€ŸEéÁÑ8 D»¸«7C ´;ùÍÃL	Ÿõ1’ë9ºPM Îžzï8 }@µ’6• ë€:Ä4ß! ´™Šµ¥OòQfë0ÌUNjø ê
`
N®‚ :ÊNq1¨ »iB%š	ü àŽ¿>£Fš¢Ñ„vÄ³Š ÖðEoGp–
õÂÁAèÂë ²Ýü?|¿v EE”þ=…`	ûŸ±	QŠ Óš`Tn¶¢ê@„ñÒÜaÑÇë ïÉ8=Ÿ¢ %åæXÆÖU<±	ä´  î"-îÂ|q	€j{©ÄàÑ å¹“Á°<~ è`dÕæ’«wOÑç{4 öDÏmôðØ€ÿ€	NõÑ ûQâ[½\¦ Ø$Ž[ˆïè›¬tÑôò¦ò ®Ò.‹É£ô€€¬Ã‚?ë÷ƒÑ Ä®±ØOÓ¦í þï¯cžäþz)”Ñ×m9n q?+,‚ã^¦€œÌìø¥‹XÑ Ó*9®&C {6?UÏ:äÎ°Š"Ñ¯¨ÊL ÊŠº+€OÐéLì-o më«æg%*n l9E$}û„ÞÂ_flmë §q9ã\‡:¤ z.ÙG	Mˆ¯®ßmë½h ‰¹±¹¬%( sw<^‚Vomë¾ZB ¶^m¸OÈ±€¥ŽÓMo më¸/ôJ ˆûœí¸ùa ÕV‚~omë ºQVÈ~ÆI öâSÇ7¡—omë±Ø º¹ÃÖ×ÉÞa iÛ¿¦Ø.~
#omëŽÉÄ¤ Ñ‡œ(¹ÝõÏ€ÿ†Üè o mëœQ{Û4° ÷Ï†lÇC¦ ‚ðšèUomë BúŠ‡ ó.žoÆ‹ŒÖomë™z x&z>ì/? Ýmãú×@Jo`Noi  áøòp‡I
 À£B}omë š÷	UrôM €Õ,š€ï^	ož0›Þf FoÆû‹9E@»Çfœ_l mäk•ÒTÇQ 6¡!¸·×¯e jˆÇPvOmä eþ`¨dhPý ëÖ÷jG5Aì÷àomäg )Hßƒjf Yßt{`¦­>™@c V— §êÙ.RÒ Å?¾qØßmä |EYEH‡° Ñ¹•çtôVF,omä}Â Õb·ÃF«—ò ¤OåÌÞ„çomär[:Í N‡¡O¥Ùu[€VÌ@Ûo mäIÕS	Ÿ +¬ÿ| ÷Í`WCo`× Æµç0É)h ®ô‡$ÎñüomäDnæ ,-]é!4PÀ4œ%N)oP  Y¾ñ"Á<Ü nRÞßƒN~hù…ßmäTc óÂ!JT ŽskJƒÂèFomäU[—Ž 0„PØŒ× '€Þ¦Øàûj£o mä «ÒêÜ sÛ*g­xëK ‹Ië{:omä ;w¤¸Óß¸R ·ºï~—h¼%M\omä	Z 0Šó>%YR –¿ éÍÂ7omäÚMÓ jÇçzxg÷¯€éB*ÝïØ+o mä’V™ à^¢iŽ, »yÌomä zRÞÒO9… =ïuªÆ†+büÖ‹omäæu äI±3I> Seÿ‘•o-]omäÿ®.Þ üb¸òŽÀôŠ’¼_À ú©¦Ðï» 1«xqSVa7¢ößmäÆ€ õŠŽù/}ž iæL_oØ¯ÐÀS¢£SË ÓßüØäíè0Tõ0<_`Áš óäbFTÿ™ [–Ó3s›OmäÜBŒU QýËóÊ¨mÀßiš§1S¯mÐ ßéÿ;·w Ìº¨r+Ô½pf–™ßmä®ñ kØºNåˆ Èß¬,Ú?¤Bomä«5¯  >_™"¬qr¬€8´6ä™êo mä¢[>Ss 5gOj]©Ó ^†òïomä ŽRM=uk N•ÝÞQ-&{~!omåo ž:9ös}´ Ú	|~oo!ï<lmåeð ï¨gaÃöOà€* ÃÈC¨ß måf×ÙÉ	Ì c/ìoƒrI }$|ð{omå `òø_PxÔá Á dj\Ôea¿~@uü&I  íBp“ÊÀÈüïhïŠ` v]ÑnâìÒ +—é.éš]Omåv/ úß£d |hñŠI¥xfºl  Ollylm åGe©¨`“e aö¾Ò© í°Fãèm˜A<ú9ú _ˆpÞÐW›8L.G8	LZ³ q7 ôá[ì g¥Iò¾ÅN	L.Æ

 7ýÈ.¨¹P@¹»}ä”&* áo¼Ò°1Ž -…ýãcHöôí&=òd¶ RbDæ¨†@l$[&8 ŽýEþq«ì 3¸ 	ë? ‡‹9&l¯š pÊÞWÆ'¾@»ìÛ2p3 o#b£‡#È  LŠ!×d°sÏÓR Åˆ/˜…@sÌo ò3–öÛæí ­{P’¢—rè-‹ Š ‚)
+!¦8§@MìDbeý ƒ ÞÄíƒW( =±©Qû¼åød–q Ï—Ü} ©14@OË1Ä”‘	Ì ÿã èŽµ]n ›ÃÁ×RTòg˜‘	Ïä¢32 ˆN°is¡” Eêk’’Æ‚ úêh'ùÖ Î  5Í¬­à(QÜŸCy ËÓ<R~“ #Î
Ú‘	×# mëQOÿ2 PÑîßD?D}‘	ÒÕÝx¥ (ÎŠí­&‡2 â‹Ë½æ‘	® ˆ Ì×DüR  5Ç ª£u²Ra¯º'~i»¼ |ƒg#.òå7B¾Q©Æô Õ÷òqJ
 ýÚ†„B•†é‘	¡¼Œ£œó }×gKWÙÖµd‘	¹È_ 5b¢Œúu˜ M)*•™j›‘	²[ÌwôÊ €Ø¡¯??pR:ŒœØ, övl^ÝK²€3oð¸,0¼±	 ŠYÂkëTòA ¢’*{ÂÛ7EjÑ‹õT ãÖÊí«Årz€í&!§bLÑ ƒ¿ÔŸÿ¹îe Ê•°8tqvÐOˆÑ–µÎÞ V4ß¯m ùQ€3~åõùwÑ “G´ñGÁÓÖ ô8ÉàÊÄ–ÔyÐæg”¸ ˜wú‚6Ìé« ¢½„'pyÅ,Ñ~+üzC \ô eo|Á°V+(ƒÑz& ÖKSD0Üò Žã~ -3°TÑu=[ý¼†à §·ú*øïŠ èh²ÑpÝL Å}Ãçg fq6‰¨ùÑqàlÜäÁ» OÈ0¦ó½©ÖjiÑM€= æÁçfi0 'gàˆßÑ[K{z6² k(X‹4,Ð*zÛè]Ò­I ­¥3Óa±ÝI€®ÒË{’òbÑ $WÝƒs¥ QÆÔ÷@fò‰…g?Ñ N\ –|dQ0éy@ÄûúÏ‘ªæ Üì¡©Ì…´ þ(uù0}%¼Ýè±	§\ Å|òñå0€­Ë)S{’ûÑ ~iŽÉ†T $Ëš8}à] ±q™Ñ|'= a´Š&Ãa‡€Ì½J#ÆJÑ ¥¹6Ë¹ê gº¡ë®©íW/5FÑáAb dUzˆ¼ Ðœ€¸÷ûë³Ñ ÿ+°»«w7 ñI6%ô(d-¹Ñõ¸^ ·Å#Ê-k€V†:>£¶Ñ ö˜9/Zò¬ NÀOÍ¤!Áœ"Ñózþ9 vAf+I§Å€Jx®%–6Ìo mæÍ¸©ºµ ÜÑtÏbNI b¾ƒ«'omæ Î\O›Ï¤ Í¯æj¹f}iªÑomæÀq “þ¡à9 êc;EhßWÏhlmæÝâ. —dA8ƒN8€·ÙÀ	Lß mæÓtÏVKä WõQ·O û¦Dö6omæ ªÕ¡Ño”% ¥’Ýe"L£omæ¢š P°K£=	À Åwüçƒcomæ£oç Õ§åãšèM€s’°œÿ”‘o mæ¼Ùmß® A“–òùjª áiˆomæ ¿†ë¤Í' éµçÓ”` Éomæ»J ÝµIÁî_ój r2Ld¸ÀÆomæ´Ò>Ç j¶ùÑBrj}€hFçYo mæ°ò) íæ@d‹ºÒ› Ü Fomæ ŒÀ_æ.çèc ™ÙÎðRA-ˆÇomæ„­ *&1ˆ£?ç éwµ´&íËomæ†å¹ º`€_Ëgdß€5«£cœ|ïo mæ‡ªÛÎ?¤ DŒp´µü _´(ÀÔomæ œ÷ä…‹l£ „—‹~4²äæþomæ›– |öÅ2‹ÒJ òipÚZIxˆð&–‘~°Ûp ?^jy]­ý¥¢P¡Ö¯mlmç oä7Y;I» 2ùÒI²ŒÛwªOmçhž ’Éê€ûÉ h<˜?@|ø¯mÐe'/£‚ §Æ“äÓ‡*ÜpÎ®ÚR±è±ç `ì×$ÖÂ ©5,ŒÑQÐPwÒOmçcÿ Ízê§0fu /S2^ÃÍÆ‡_´@c¢mÄž Ñg¦4‹EÚR ¤Ù2Íßmç qüoÁk"<Ú ®‹¸’ÝÝ°Jþ?DÐOáeŒ m=ž9ò4ÀSSKði†` ApäßHj ½†ˆƒ[°ïf_`B×ÉW fªÊ½ŽÛÊ€ j
b,Ï¿	 mçYå™¡g» t%ÌÎÙõ_0×Æ‡»ÏhÐZ¸ ­¶-×œ‘kÂ »)
-…s‹nßmç[~!. "«Tx’r€¬ñºÃ.	o`:m»_Ý$ vbb‚Ø/•è}6Åo`ÃSŽ âS.<ÕÃê§ÀAÆÕ–.Ÿƒ°	 RRó§ŽóAH ‘á÷1w¢ìBZpÝßmç-« XËgfÔa_ U3ßYd<«/¨Ð+ÝiÜ¥§ ®¬d
ÊTéÚ é’o‰fßmç 'È?#=ý l68ñ„@!n½¸omç>t =-…¢âÝ Áè:žDš8Àomç?C‘6 CÒz.bVÀ/4N.s¿¿	°	 4z¹ä‹‰Ï XP KhÙ%ßmç5— «SJ®;`! ”å‹1V0Ô>omç1r¾@ (Ü~xhD%€½cP@Qo mçG— Ýo uoW:c0°ÄH1ÏÝ°	Ï “BT¸‹:÷N æm £‡ÀßmçäÐa "x@Þyæ %€¾ŸgtTŒo mç|.†ïþ ºúi–9vS @jÖ•omç é3·õFð= ¥wINÏÔšomçæ8 ¤Üfßt ßQS+3jßî ücÖLãà ·6kÓ¶Ì :Î
jòßmç þD²ë9¯Z “Og°CòÛ{îfXº lllOllyl mçðáIÀN ‹Ÿ7ÊJ’æ`Ëˆ`‚¨ àm˜ñ{F˜r4 ·†gåK?à<hÁíF 	L Ê% 2ÒQGp ûmM.|Ô/ÊÏLÂÐ\÷ ¶fHž-_€T€>¹–}r& ÞŸÀLÓ ÊË€Y¬ÿÉ{­ÞT&Øó,Ë ê$Axo$€
i*3ûW& ÔäêÅ±={ ž”]dÑNcf¯¯þ¾ ¢…ÇxÒXå»€ÐdÜF‡wŸ §ÒoƒU?í H*4Qa\Á qn S¸jÙãÖ‰€a˜Jþ4mÜ ²•ãFJw† û"&R?Bè(ŒÀ#Ù Ô[¿M §ó€‹p3ôF ‰¸ŸŸ èü )ìø<xž|vÐ‹³ù ›ÛË[«/ìj€—Y”ÌS‘	 €ôBV4Ú 6Ç¦£n6)öô"‘	Z@ ´èžI’W€1Qÿ\^‘	 —çú/Pÿˆˆ ëGËDÖc"Gžs‘	“ Û• üÒoh^îÕ€¢9ãžsß	 àmXÂƒü¯= ð”i=Ó>+Þ(ìZE	lˆ¥àk µxÇ&î½|] ÷—RI}ëm7ÞQg– Úe €Y>ö±©Â@#2I$óN‘	a ¢ÑÑÐ¡¥® &×‡æ©ãKi‡}‘	zp¢® )û®…ÒnŽæ@ðð!‘	w @©Zž"½ 0‡¬™<Ë™Ù
‘	L&Íµ ùo6Fß³°@ 3Ã‘	O »y1Ù§ç Á+û:³° ­ªÓ‘	GÓù“ IÅ®ËYò–@rÖì%LÑ@ :Æ«ÿtÌ‹ó n„ƒhø¯Î÷*¸Ñ_Vry Ù‰8 ¹ì=@¸Ûë8ÒÚ t:×eZyûk Ôÿpnö#ýÑT"óŽ3 G 5÷Ë)´ìT1kàTþ È”§—†ŒL ¬³ùâ;º™ò±	U ínïm ‚r¶IŒÖã]Y¹<IU1 ù9tÍý vÙ<¼±	/»ãr`‹½ KÍ>àqôo<ðPäÑ"By ŠFçÿ} a+Æ~“XÑ1/xf•  Y	¬«x%éd¼Ò“æ XP¥#dPŽ€ZKÎtµÜÚÒ Å]äŽ(ýÍ¹ ‡ª (3fãš„3ÑF Î˜~%ÔÍÕ‡@N=8ëÑ ÂË7l†6 q¥VÙKØ‚àÒÜµ)‘‰ Ù¯EêÃ˜ã` Ž†-ÑÝ ƒ|äHvÞ nd¡Pf÷÷tžÑï\09 Z†Ñ­Å½/«·'±¥àéê ­‘ˆã
Ì ñŽÑÂI–£G_±	é’mä‘ü Xm¶æD‡ZXø~Ó0Òyäô F1 –ï À»ÎÁzž¶±	æRÀû¯?æ ÷ ¯Èyë@b¾¡ÄÑþ€Ù òy§§ÄPÔB HC´wðÑø(@;¬µ „©Ó` ñ!°ÑñÔ. V‘gqD¤ßð ¤R¹ì÷šxÒÕ+!UGžÇ O„ ™
qŠÚ4%ÑÌÕRF ï}¿FÔÀ@ñ¹yË4/3l màÉ0hõ9s EWL¹7ÃŠ ¼"#ßmà +ŸåX-ï AÛ%!HvÏhÐ¥BZ4! àþÂù†© ÕˆPßmà ¹¥gÿØûÉ» Í«{%k5•S|omà±æ ''î8öSö CCËWw 1o`¥+zN RC,>ëYîj rJ}–omà Œ~¢Úy¯ S¨ãîçô6Ôo ‰Äèü ÄT¾Q†ú’|€lV)»àæß màŠ£ž¾Ð“ ÔkMŽ`Ss0öt>¼¿	Ð’Ë Y¬^$[Q@9 ‚ßÉ&S¦þ ßmáiù(a %²µË¨s=¦€¬ÿhy[’o máfme
4 ÊÇvg+ðYp¸Y›ƒpá }k›bµHì L…¤’’g/OK¯”lmát» IEDl|<«„ s!hIiõŸEOmáp"Û k_nU)¥€ß#üÊùo`Äs´ÂwÏ
 .£¡|„D¢¥­¯omásó ,ªäiè‰Êp ^`[:bºÙîomáKÄs  ±—xˆ¿£€f”X!^^•o máFdK¾ úˆÐ}“¦0th5¼ïŠG¤ Çã÷"ZÇŒ 8ß ±}”vCÏ`AÐ§á q Z«±Þ¿øÌïö£OmáBX öºÎaæ ¹¥·wŒóŠA_´ÐYq;|Ø¦ aBŒýq=›P0‚ !/3`T) ‚âwÞb r!õlOßû¥OmáT‹|. Þ[[Æ‚€]MGoœo má;Z\