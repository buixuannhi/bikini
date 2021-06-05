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
             ����3 �✘��\f B�W��5���m�+�@� �6[����@o��*=om �<��k�� �$W�3����om�m �����M�� �.����om�k4� N������ 8v�,���om�a�4�} �ˁjKQ�o �(�;ʟlm �~��>�� \�����\~��P��m�z �˶�bYB "�I0�`՟��R	�lml  Olly lm�/4�; �<<=X�Q�vU�R�	�)|W"�Zj ����B2�B�_L$�` 掠5&�� ��+WL��L&G,;ޔ� TƇ�w#S���g�&'ˌ 1to��>n ��:6�+8�&>�����w &&H�f�C.&kN�&6� ����6/ �'��јQ��fa�m< �IC@�� �M7B��) �n�1���@7��}(P�&7 �>Ea��� �8z� 3��0;A/G |��M[@�SC�Re  	$\iE|w 0���d�� j  �F!K P8f�ǹ�M@NJNq� ��B|Y  �P�_�#�	&M�N ��bc��@Z����x�	 ���m�

 (V%!���ƽ�	�� l=���g�@�%�I��	 �XR�q�TJ  K��S��	�4ڶ� �4�.�� ��֋�	�� R��y�T� �����$��	��s c-Z˫��]*l�M��: ���V�E� ��y6�XQ�����" :�ܫ�l��e���	��� e��l��� ��R�R�b�	�4O��
� ]sթ�_\Ц�>�	�� �(���þ3����a4&�	 �S
�Q� J@��72t=/�����J L��T{�|���^'�� ���gOћF .���_�� ����� L��&�x����~5��� ������ !������j-���֘ Ʌ;��si�����X�'D� ���7�N_� |��$�Oխ*�4��J�h x����ӑ�#1v�h��� ���Z�b� ������	�|IG���î �+iECj6��P��I�]� ��Zb�#/ �uk�����0
��}�� (�? ��շ@I&�$�ra� 	�Qu�i� �1��+!���1�	�k�<� .����'� ����,R�# �6`ۈ K*�Hw��f�	�h���� TF���X �m_�qa�a ������� �2^,;��ر	|�5� ����j�|�@Q�%�~ uh<�iT� Ɍ]+�CA��xƖ^�  �壮z@(H��L��� ���e��!� w�|�L�o8�p=%�b �	�,�ɜ{�H���g j�(}��@/�)qp� J�/?7cJ� ���!�'�v���^��� =�W���v�ep����q Z�ӝ<L� �����JH��[�� T:�� gǀ!�W
�IRo m�T�P;�i �̩@��՗ ����om� (�<��3>L �]��!#��%om�*� <�N��NV �aV6u@sgom�%ޤ� ���"@���`�Wl m�;��/U �M
�:�� s��Z��m� 77LZ�� ��Xz>�|M��o`д� ��S�PK����ԘmGI@ 1��.�1�� �0|:�DɆ��m�� ;���@�w� <�~oK!0I� I`S� J��b�% �]��m� ��y�X�� GK����N���om��� ��'�v��k �@�~��(�.om���� c����fO� RjY�h o m��s�ib� q��5Yf�� ��y|^om� �0��G2�� N}$]��\�8�om��� �<h�Q�H �*�KD/�+o`��)8 ������+� `~I��om� �މ��X�2 `��5+I,���om��� ��P�T��& �`�R��k�om���4� �x�V� &�^�Hp��wo m�ә��T� �>�y��;| ���!~om� ���H9E�U �+٧�z-�n��om鹚 �轠׳/= ��( 3��om鴇�� �ّ���~�,��eμo m鷋�y�B �!��:�0r7�=�c�&�N @�~�k��s ~Z�PY�z�m���3 ǈ���؂ۀ����j�yo m�k/6Q�Z l�,�l, ����dom� x���6�S +^#K-�-��om�y2 I��~�n� �e��(�ǻ$om�N	� Ί2�"=�H�UV���o m�H�Gd* �7F?G�DIlm� ^�pA߹ٟ �z�u����^?�`[; �w>�b=�{�W�W��TjO m�R�H�~� ���+�0��ИO�&� �]�9�0�A ����~��m�'~�_ G�Tn���,�d:� "��y. � �T�{'v��m\�m�9� �0�"�o� �l�!����o�5�=�J /<����80ɂ�U"`6� X���+� ��D_�ѭU�Om�37� r�(B@퀀P�̊��o m�Js; J&7��v� �K�	om� R�)HZ� [�ŀvVܦ_�	�� �E<�)�݀�6���^�� m��� M�:��	0�J��/���k ��Ҍ��  �=�m��`��@�6� �Oq�3�+0[�S�W`�� R��7 Aw:���8��\a��`6�A ���������Q�/m�� Sb��p~px ��/+z\�y��E�� �٬��[ ^�]���ml  Ollyl m�˭�k>Z it�Q��i��:��	� �t��1�� l~�h���
�ULǫKl �O��q���,W�Z�L �u��	sR� �Y!s��;
��&ъ�� �l�@Q��*�\5���& ӓr�( [i�Um���x&���c uV��s?�~_���(� �1��h{�� �k+-�e������X w˵���T‸,��) �dG\��b� �%"��r�����v�� �Vr���u�@��ԕ�*� �r�cX	�� ���v��dg��	]� �n����.�@'	�*I�� ����0%\L p-Ŋ�o���	�%�g �T��7�@�{�K�	� g�7q�G K�t��#�g��	��L�! n�/<ru6@��4ݶ��	� iө�!�U �@��C���	�n=:� ������6���9Z�	 h�/�\�� }I��_.y� �	f:�< YS�B��E��G����	 q�_�=� !��L�M&��Vڑ	r��z (\�9Ȝ�@Yَ���t� M�s�=� a����&����hQEl. =7����C�+���Ze��	 FH��?�� 7ɃL��&L���	@�D� ��e�^K��2_�b�(T� ���s\# 0����%!k��Q���6 oBw6B@�|�����S �!4 �c� k'����|`��.�~E ��B�1�@�=Z!���( j��ok�� ?d1~�ul�M�"���� �ʒ���Y@���Cݱ	< {����ý ��gĪ�^q��=��e" �G�����>@���E���8 D����7C �;���L	��1��9�PM ��z�8 }�@��6� �:�4�! �����O�Qf�0�UNj� �
`
N�� :�Nq1� �iB%�	� ���>�F����vĳ� ��EoGp�
���A��� ���?|�v EE��=�`	���	Q� Ӛ`Tn���@����a��� ��8=��� %��X��U<�	�� �"-��|q	�j{���� 幓��<~ �`d�撫wO���{4 �D�m��؀��	N�� �Q�[�\� �$�[�����t���� ��.�ɣ􀀬Â?���� Į��OӦ� ��c���z)���m9n q?+,��^��������X� Ӑ*9�&C {6?U�:����"����L �ʊ�+�O��L�-o m��g%*n l9E$}����_flm� �q9�\�:� z.�G	M����m�h �����%( sw<^�Vom�ZB �^m�Oȱ�����Mo m�/�J �����a �V�~om� �QV�~�I ��S�7��om�� �������a iۿ��.~
#om��Ĥ ч�(���π�����o m�Q{�4� �φl�C� ���Uom� �B��� �.�o����om�z x&z>�/? �m���@Jo`Noi  ���p�I
 ��B}om� ��	Ur�M ��,���^	o�0��f Fo���9E@���f�_�l m�k��T�Q 6�!��ׯe j��PvOm� e�`�dhP� ���jG5A���om�g )H߃jf Y�t{`��>��@c�V� ���.R� �?�q��m� |EY�EH�� ѹ��t�VF,om�}� �b��F��� �O��ބ�om�r[:� N��O��u[�V��@�o m�I�S	� +��|���`WCo`� Ƶ�0�)h ��$���om�Dn� ,-]�!4P�4�%N)oP  Y��"�<� nR�߃N~h���m�Tc ��!JT �skJ��Fom�U[�� 0�P،נ'�ަ���j�o m� ���� s�*g�x�K �I�{:om� ;w���߸R ���~�h�%M\om�	Z 0��>%YR ������7om��M� j��zxg����B*���+o m��V� �^�i�, �y��om� zR��O9� =�u�Ɔ+b�֋om��u �I�3I> Se����o-]om���.� �b���􊒐�_� ����� 1��xqSVa7���m�ƀ �����/}� i�L_o����S��S� �������0T�0<_�`�� ��bFT�� [��3s�Om��B�U Q���ʨm��i��1S�m� ���;��w ̺�r+Խpf���m�� kغN�� �߬,�?�Bom�5�� >_�"�qr��8�6��o m�[�>Ss 5gOj]�� ^���om� �R�M=uk N���Q-&{~!om�o ��:9�s}� �	|~oo!�<lm�e� �ga��O��* ��C�� m�f���	� c/�o�rI }$|�{om� `��_Px�� � dj\�ea�~@u�&I  �Bp������h�` v]�n��� +��.�]Om�v/ �ߣd |h�I�xf�l  Ollylm �Ge��`�e a��ҩ �F��m�A<�9� _�p��W�8L.G8	LZ� q7 ��[� g�I���N	L.�

 7��.��P@��}�&* �o�Ұ1� -���cH���&=�d� R�bD樆@l$[&8 ��E�q�� 3� 	�? ��9&l�� p��W�'�@���2p3 o#b��#� �L�!�d�s��R ň/���@�s�o �3����� �{P���r�-� � �)
+!�8�@M�D�be� �����W( �=��Q����d�q ϗ�}��14@O�1Ĕ�	� ��莵]n ����RT�g��	��32 �N�is�� E�k��Ƃ ��h'�֠� �5�ͬ��(QܟCy� ��<R~� #�
ڑ	�# m�QO�2 P���D?D}�	���x� (Ί�&�2 �˽�	� � ���D�R  5� ��u�Ra��'~i�� |�g#.��7B�Q��� ���q�J
 �چ�B����	������ }�gKW����d�	��_ 5b���u� M)*��j��	�[�w�� ��ء��??pR:���, �vl^�K��3o�,0��	 �Y�k�T�A ��*{��7Ej���T �����rz��&!�bL� ��ԟ���e ʕ�8tqv�O������ V4߯m��Q�3~���w� �G��G��� �8���Ė�y��g�� �w��6�� ���'py�,�~+�zC \��eo|��V+(��z& �KSD0�� ��~�-3�T�u=[���� ���*�����h��p�L �}��g fq6����q�l���� O�0����ji�M�= ���fi0 'g����[K{z6� k(X�4,�*z��]��I ��3�a��I����{��b� $W݃�s� Q���@f��g?� N\ �|dQ0�y@���ϑ�� �졩̅� �(u�0}%���	�\ �|���0���)S{��� ~i�ɆT $˚8}�] �q��|'= a��&�a��̽J#�J� ��6˹� g��뮩�W/5F��Ab dUz�� М������ �+���w�7 �I6%�(d-����^ ��#�-k�V�:>��� ��9/Z� N�O��!��"��z�9 vAf+I�ŀJx�%�6�o m�͸���� ��t�bNI b���'om� ΁\O�Ϥ ͯ�j�f}i��om��q �����9 �c;Eh�W�hlm���. �dA8�N8����	L� m��t�VK� W�Q��O ��D�6om� ����o�% ���e"L�om梚 P�K�=	� �w�烐com�o� է���M�s������o m��m߮ A����j� ��i�om� �����' ��Ӕ` �om�J ݵI��_�j r�2Ld���om��>� j���Brj}�hF�Yo m��)� ��@d��қ � F�om� ��_�.��c ����RA-��om愭 *&1��?� �w��&��om�� �`�_�gd߀5��c�|�o m懪��?� D�p��� _�(��om� ��䅋l� ���~4����om曖 |��2��J ��ip�ZIx��&��~��p ?^jy]����P�֯mlm� o�7Y;I� 2��I����w�Om�h� ������ h<�?@|��m�e�'/�� �Ɠ�Ӈ*�pή�R��� `��$֝� �5,��Q�Pw�Om�c� �z�0fu /S2^��Ƈ_�@c�mĞ �g�4�E�R ��2��m� q�o�k"<� �����ݰJ�?D�O�e� m=�9�4�SSK�i�` Ap��Hj ������[��f_`B��W f�ʽ��ʀ�j
b,Ͽ	 m�Y噡g� t%����_0�Ƈ��h�Z� ��-ל�k� �)
-�s�n�m�[~!. "��Tx�r����.	o`:m�_�$ vbb��/��}6�o`�S� �S.<����A�Ֆ.���	 RR��AH ���1w��BZp��m�-� X�gf�a_ U3�Yd<�/��+�iܥ� ��d
�T�� �o�f�m� '�?#=� l68�@!n��om�>t =-����� ��:�D�8�om�?C�6 C�z.bV�/4N.s��	�	 4z����� XP Kh�%�m�5� �SJ�;`! ��1V0�>om�1r�@ (�~x�hD%���cP@Qo m�G� �o uoW:�c0��H1�ݰ	� �BT��:�N �m������m���a "x@�y� %���gtT�o m�|.��� ��i�9vS @j��om� �3��F�= �wIN���om��8 ���f�t �QS+3j�� �c�L�� �6kӶ� :�
j��m� �D��9�Z �Og�C��{�fX� lllOllyl m���I�N ��7�J��`ˈ`�� �m��{F�r4 ���g�K?�<h��F 	L �%�2�QGp �mM.|�/��L��\� �fH�-_�T�>��}r& ޟ�L��� �ˀY���{��T&��,� ��$Axo$�
i*3�W& ���ű={ ��]d�Ncf����� ���x�X廀�d�F�w� ��o�U?� H*4Qa\��qn S�j��։�a�J�4m� ���FJw� �"&R?B�(��#� �[�M �󀋍p3�F ���� �� )��<x�|v���� ���[�/�j��Y���S�	 ��BV4� 6Ǧ�n6)��"�	�Z@ ��I��W�1Q�\^�	 ���/P��� �G�D�c"G�s�	� ە ��oh^�Հ��9�sߐ	 �mX��= �i=�>+�(�ZE	l���k �x�&�|] ��RI}�m7�Qg���e �Y>����@#2I$�N�	a ���С��� &ׇ��Ki�}�	zp�� )����n��@��!�	w @��Z�"� 0���<˙�
�	L&�� �o6F߳�@ 3Ñ	O �y1٧� �+�:�����ӑ	G��� IŮ�Y�@r��%L�@ :ƫ�t̋� n��h����*��_Vry ى8 ��=@���8�� t:�eZy�k ��pn�#��T"�3 G 5��)��T�1k�T� Ȕ�����L ����;���	U �n�m �r��I���]Y�<IU�1 �9t�� v��<��	/��r`�� K�>�q�o<�P��"By �F��} a+Ɲ~�X�1/xf� � Y	��x%�d���� XP�#dP��ZK�t���� �]�(�͹ ���(3f��3�F� Θ~%��Շ@N=8�� ��7l��6 q�V�K����ܵ)�� ٯE�Ø�` ��-�� �|�Hv� nd�Pf��t���\09 Z�ѭŽ/���'����� ����
� ���I��G_�	�m�� Xm��D�ZX�~�0�y�� F1 ��� ����z���	�R���?� ����y�@b������� �y���P�B HC�w���(@;�� ���`��!�����. V�gqD��� �R����x��+!UG�� O� �
q��4%���RF �}�F��@�y�4/3l m��0h�9s EWL�7Ê �"#�m� +��X-� A�%!�Hv�h��BZ4! ������ Ր��P�m� ��g���ɻ ͫ{%k5�S|om�� ''�8�S� CC�Ww 1o`�+zN RC,>�Y�j rJ}�om� �~�ځy� S�����6�o ���� �T�Q���|�lV)���� m�����Г �kM�`Ss0�t>��	��� Y�^$[Q@9 ���&S�� �m�i�(a %��˨s=����hy[�o m�fme
4 ��vg+�Y�p�Y��p� }k�b�H� L����g/OK��lm�t� IEDl|<�� s!hIi��EOm�p"� k_nU�)���#����o`�s��w�
 .��|�D����om�s� ,��i��p ^`[:b���om�K�s  ��x����f�X!^^�o m�FdK� ����}��0th5�G� ���"Zǌ 8� �}�vCϏ`AЧ� q Z��޿�����Om�BX ���a� ���w��A_��Yq;|ئ aB��q=�P0��!/3`T) ��w�b r!�lO���Om�T�|. �[[Ƃ�]MGo�o m�;Z\