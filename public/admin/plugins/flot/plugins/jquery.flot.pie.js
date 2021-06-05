/* Flot plugin for rendering pie charts.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Licensed under the MIT license.

The plugin assumes that each series has a single data value, and that each
value is a positive integer or zero.  Negative numbers don't make sense for a
pie chart, and have unpredictable results.  The values do NOT need to be
passed in as percentages; the plugin will calculate the total and per-slice
percentages internally.

* Created by Brian Medendorp

* Updated with contributions from btburnett3, Anthony Aragues and Xavi Ivars

The plugin supports these options:

    series: {
        pie: {
            show: true/false
            radius: 0-1 for percentage of fullsize, or a specified pixel length, or 'auto'
            innerRadius: 0-1 for percentage of fullsize or a specified pixel length, for creating a donut effect
            startAngle: 0-2 factor of PI used for starting angle (in radians) i.e 3/2 starts at the top, 0 and 2 have the same result
            tilt: 0-1 for percentage to tilt the pie, where 1 is no tilt, and 0 is completely flat (nothing will show)
            offset: {
                top: integer value to move the pie up or down
                left: integer value to move the pie left or right, or 'auto'
            },
            stroke: {
                color: any hexidecimal color value (other formats may or may not work, so best to stick with something like '#FFF')
                width: integer pixel width of the stroke
            },
            label: {
                show: true/false, or 'auto'
                formatter:  a user-defined function that modifies the text/style of the label text
                radius: 0-1 for percentage of fullsize, or a specified pixel length
                background: {
                    color: any hexidecimal color value (other formats may or may not work, so best to stick with something like '#000')
                    opacity: 0-1
                },
                threshold: 0-1 for the percentage value at which to hide labels (if they're too small)
            },
            combine: {
                threshold: 0-1 for the percentage value at which to combine slices (if they're too small)
                color: any hexidecimal color value (other formats may or may not work, so best to stick with something like '#CCC'), if null, the plugin will automatically use the color of the first slice to be combined
                label: any text value of what the combined slice should be labeled
            }
            highlight: {
                opacity: 0-1
            }
        }
    }

More detail and specific examples can be found in the included HTML file.

*/

(function($) {
    // Maximum redraw attempts when fitting labels within the plot

    var REDRAW_ATTEMPTS = 10;

    // Factor by which to shrink the pie when fitting labels within the plot

    var REDRAW_SHRINK = 0.95;

    function init(plot) {
        var canvas = null,
            target = null,
            options = null,
            maxRadius = null,
            centerLeft = null,
            centerTop = null,
            processed = false,
            ctx = null;

        // interactive variables

        var highlights = [];

        // add hook to determine if pie plugin in enabled, and then perform necessary operations

        plot.hooks.processOptions.push(function(plot, options) {
            if (options.series.pie.show) {
                options.grid.show = false;

                // set labels.show

                if (options.series.pie.label.show === "auto") {
                    if (options.legend.show) {
                        options.series.pie.label.show = false;
                    } else {
                        options.series.pie.label.show = true;
                    }
                }

                // set radius

                if (options.series.pie.radius === "auto") {
                    if (options.series.pie.label.show) {
                        options.series.pie.radius = 3 / 4;
                    } else {
                        options.series.pie.radius = 1;
                    }
                }

                // ensure sane tilt

                if (options.series.pie.tilt > 1) {
                    options.series.pie.tilt = 1;
                } else if (options.series.pie.tilt < 0) {
                    options.series.pie.tilt = 0;
                }
            }
        });

        plot.hooks.bindEvents.push(function(plot, eventHolder) {
            var options = plot.getOptions();
            if (options.series.pie.show) {
                if (options.grid.hoverable) {
                    eventHolder.unbind("mousemove").mousemove(onMouseMove);
                    eventHolder.bind("mouseleave", onMouseMove);
                }
                if (options.grid.clickable) {
                    eventHolder.unbind("click").click(onClick);
                }
            }
        });

        plot.hooks.shutdown.push(function (plot, eventHolder) {
            eventHolder.unbind("mousemove", onMouseMove);
            eventHolder.unbind("mouseleave", onMouseMove);
            eventHolder.unbind("click", onClick);
            highlights = [];
        });

        plot.hooks.processDatapoints.push(function(plot, series, data, datapoints) {
            var options = plot.getOptions();
            if (options.series.pie.show) {
                processDatapoints(plot, series, data, datapoints);
            }
        });

        plot.hooks.drawOverlay.push(function(plot, octx) {
            var options = plot.getOptions();
            if (options.series.pie.show) {
                drawOverlay(plot, octx);
            }
        });

        plot.hooks.draw.push(function(plot, newCtx) {
            var options = plot.getOptions();
            if (options.series.pie.show) {
                draw(plot, newCtx);
            }
        });

        function processDatapoints(plot, series, datapoints) {
            if (!processed) {
                processed = true;
                canvas = plot.getCanvas();
                target = $(canvas).parent();
                options = plot.getOptions();
                plot.setData(combine(plot.getData()));
            }
        }

        function combine(data) {
            var total = 0,
                combined = 0,
                numCombined = 0,
                color = options.series.pie.combine.color,
                newdata = [],
                i,
                value;

            // Fix up the raw data from Flot, ensuring the data is numeric

            for (i = 0; i < data.length; ++i) {
                value = data[i].data;

                // If the data is an array, we'll assume that it's a standard
                // Flot x-y pair, and are concerned only with the second value.

                // Note how we use the original array, rather than creating a
                // new one; this is more efficient and preserves any extra data
                // that the user may have stored in higher indexes.

                if ($.isArray(value) && value.length === 1) {
                    value = value[0];
                }

                if ($.isArray(value)) {
                    // Equivalent to $.isNumeric() but compatible with jQuery < 1.7
                    if (!isNaN(parseFloat(value[1])) && isFinite(value[1])) {
                        value[1] = +value[1];
                    } else {
                        value[1] = 0;
                    }
                } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                    value = [1, +value];
                } else {
                    value = [1, 0];
                }

                data[i].data = [value];
            }

            // Sum up all the slices, so we can calculate percentages for each

            for (i = 0; i < data.length; ++i) {
                total += data[i].data[0][1];
            }

            // Count the number of slices with percentages below the combine
            // threshold; if it turns out to be just one, we won't combine.

            for (i = 0; i < data.length; ++i) {
                value = data[i].data[0][1];
                if (value / total <= options.series.pie.combine.threshold) {
                    combined += value;
                    numCombined++;
                    if (!color) {
                        color = data[i].color;
                    }
                }
            }

            for (i = 0; i < data.length; ++i) {
                value = data[i].data[0][1];
                if (numCombined < 2 || value / total > options.series.pie.combine.threshold) {
                    newdata.push(
                        $.extend(data[i], {     /* extend to allow keeping all other original data values
                                                   and using them e.g. in labelFormatter. */
                            data: [[1, value]],
                            color: data[i].color,
                            label: data[i].label,
                            angle: value * Math.PI * 2 / total,
                            percent: value / (total / 100)
                        })
                    );
                }
            }

            if (numCombined > 1) {
                newdata.push({
                    data: [[1, combined]],
                    color: color,
                    label: options.series.pie.combine.label,
                    angle: combined * Math.PI * 2 / total,
                    percent: combined / (total / 100)
                });
            }

            return newdata;
        }

        function draw(plot, newCtx) {
            if (!target) {
                return; // if no series were passed
            }

            var canvasWidth = plot.getPlaceholder().width(),
                canvasHeight = plot.getPlaceholder().height(),
                legendWidth = target.children().filter(".legend").children().width() || 0;

            ctx = newCtx;

            // WARNING: HACK! REWRITE THIS CODE AS SOON AS POSSIBLE!

            // When combining smaller slices into an 'other' slice, we need to
            // add a new series.  Since Flot gives plugins no way to modify the
            // list of series, the pie plugin uses a hack where the first call
            // to processDatapoints results in a call to setData with the new
            // list of series, then subsequent processDatapoints do nothing.

            // The plugin-global 'processed' flag is used to control this hack;
            // it starts out false, and is set to true after the first call to
            // processDatapoints.

            // Unfortunately this turns future setData calls into no-ops; they
            // call processDatapoints, the flag is true, and nothing happens.

            // To fix this we'll set the flag back to false here in draw, when
            // all series have been processed, so the next sequence of calls to
            // processDatapoints once again starts out with a slice-combine.
            // This is really a hack; in 0.9 we need to give plugins a proper
            // way to modify series before any processing begins.

            processed = false;

            // calculate maximum radius and center point
            maxRadius = Math.min(canvasWidth, canvasHeight / options.series.pie.tilt) / 2;
            centerTop = canvasHeight / 2 + options.series.pie.offset.top;
            centerLeft = canvasWidth / 2;

            if (options.series.pie.offset.left === "auto") {
                if (options.legend.position.match("w")) {
                    centerLeft += legendWidth / 2;
                } else {
                    centerLeft -= legendWidth / 2;
                }
                if (centerLeft < maxRadius) {
                    centerLeft = maxRadius;
                } else if (centerLeft > canvasWidth - maxRadius) {
                    centerLeft = canvasWidth - maxRadius;
                }
            } else {
                centerLeft += options.series.pie.offset.left;
            }

            var slices = plot.getData(),
                attempts = 0;

            // Keep shrinking the pie's radius until drawPie returns true,
            // indicating that all the labels fit, or we try too many times.
            do {
                if (attempts > 0) {
                    maxRadius *= REDRAW_SHRINK;
                }
                attempts += 1;
                clear();
                if (options.series.pie.tilt <= 0.8) {
                    drawShadow();
                }
            } while (!drawPie() && attempts < REDRAW_ATTEMPTS)

            if (attempts >= REDRAW_ATTEMPTS) {
                clear();
                target.prepend("<div class='error'>Could not draw pie with labels contained inside canvas</div>");
            }

            if (plot.setSeries && plot.insertLegend) {
                plot.setSeries(slices);
                plot.insertLegend();
            }

            // we're actually done at this point, just defining internal functions at this point
            function clear() {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                target.children().filter(".pieLabel, .pieLabelBackground").remove();
            }

            function drawShadow() {
                var shadowLeft = options.series.pie.shadow.left;
                var shadowTop = options.series.pie.shadow.top;
                var edge = 10;
                var alpha = options.series.pie.shadow.alpha;
                var radius = options.series.pie.radius > 1 ? options.series.pie.radius : maxRadius * options.series.pie.radius;

                if (radius >= canvasWidth / 2 - shadowLeft || radius * options.series.pie.tilt >= canvasHeight / 2 - shadowTop || radius <= edge) {
                    return;    // shadow would be outside canvas, so don't draw it
                }

                ctx.save();
                ctx.translate(shadowLeft, shadowTop);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = "#000";

                // center and rotate to starting position
                ctx.translate(centerLeft, centerTop);
                ctx.scale(1, options.series.pie.tilt);

                //radius -= edge;
                for (var i = 1; i <= edge; i++) {
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
                    ctx.fill();
                    radius -= i;
                }

                ctx.restore();
            }

            function drawPie() {
                var startAngle = Math.PI * options.series.pie.startAngle;
                var radius = options.series.pie.radius > 1 ? options.series.pie.radius : maxRadius * options.series.pie.radius;
                var i;
                // center and rotate to starting position

                ctx.save();
                ctx.translate(centerLeft, centerTop);
                ctx.scale(1, options.series.pie.tilt);
                //ctx.rotate(startAngle); // start at top; -- This doesn't work properly in Opera

                // draw slices
                ctx.save();

                var currentAngle = startAngle;
                for (i = 0; i < slices.length; ++i) {
                    slices[i].startAngle = currentAngle;
                    drawSlice(slices[i].angle, slices[i].color, true);
                }

                ctx.restore();

                // draw slice outlines
                if (options.series.pie.stroke.width > 0) {
                    ctx.save();
                    ctx.lineWidth = options.series.pie.stroke.width;
                    currentAngle = startAngle;
                    for (i = 0; i < slices.length; ++i) {
                        drawSlice(slices[i].angle, options.series.pie.stroke.color, false);
                    }

                    ctx.restore();
                }

                // draw donut hole
                drawDonutHole(ctx);

                ctx.restore();

                // Draw the labels, returning true if they fit within the plot
                if (options.series.pie.label.show) {
                    return drawLabels();
                } else return true;

                function drawSlice(angle, color, fill) {
                    if (angle <= 0 || isNaN(angle)) {
                        return;
                    }

                    if (fill) {
                        ctx.fillStyle = color;
                    } else {
                        ctx.strokeStyle = color;
                        ctx.lineJoin = "round";
                    }

                    ctx.beginPath();
                    if (Math.abs(angle - Math.PI * 2) > 0.000000001) {
                        ctx.moveTo(0, 0); // Center of the pie
                    }

                    //ctx.arc(0, 0, radius, 0, angle, false); // This doesn't work properly in Opera
                    ctx.arc(0, 0, radius, currentAngle, currentAngle + angle / 2, false);
                    ctx.arc(0, 0, radius, currentAngle + angle / 2, currentAngle + angle, false);
                    ctx.closePath();
                    //ctx.rotate(angle); // This doesn't work properly in Opera
                    currentAngle += angle;

                    if (fill) {
                        ctx.fill();
                    } else {
                        ctx.stroke();
                    }
                }

                function drawLabels() {
                    var currentAngle = startAngle;
                    var radius = options.series.pie.label.radius > 1 ? options.series.pie.label.radius : maxRadius * options.series.pie.label.radius;

                    for (var i = 0; i < slices.length; ++i) {
                        if (slices[i].percent >= options.series.pie.label.threshold * 100) {
                            if (!drawLabel(slices[i], currentAngle, i)) {
                                return false;
                            }
                        }
                        currentAngle += slices[i].angle;
                    }

                    return true;

                    function drawLabel(slice, startAngle, index) {
                        if (slice.data[0][1] === 0) {
                            return true;
                        }

                        // format label text
                        var lf = options.legend.labelFormatter, text, plf = options.series.pie.label.formatter;

                        if (lf) {
                            text = lf(slice.label, slice);
                        } else {
                            text = slice.label;
                        }

                        if (plf) {
                            text = plf(text, slice);
                        }

                        var halfAngle = ((startAngle + slice.angle) + startAngle) / 2;
                        var x = centerLeft + Math.round(Math.cos(halfAngle) * radius);
                        var y = centerTop + Math.round(Math.sin(halfAngle) * radius) * options.series.pie.tilt;

                        var html = "<span class='pieLabel' id='pieLabel" + index + "' style='position:absolute;top:" + y + "px;left:" + x + "px;'>" + text + "</span>";
                        target.append(html);

                        var label = target.children("#pieLabel" + index);
                        var labelTop = (y - label.height() / 2);
                        var labelLeft = (x - label.width() / 2);

                        label.css("top", labelTop);
                        label.css("left", labelLeft);

                        // check to make sure that the label is not outside the canvas
                        if (0 - labelTop > 0 || 0 - labelLeft > 0 || canvasHeight - (labelTop + label.height()) < 0 || canvasWidth - (labelLeft + label.width()) < 0) {
                            return false;
                        }

                        if (options.series.pie.label.background.opacity !== 0) {
                            // put in the transparent background separately to avoid blended labels and label boxes
                            var c = options.series.pie.label.background.color;
                            if (c == null) {
                                c = slice.color;
                            }

                            var pos = "top:" + labelTop + "px;left:" + la*w��m��~� �;����w�˿9b��7o�ٔ���� Ԣ��3�.@��m�� krI�1 � ����yA4W.�om���� �n�O��&�?��s3`�h@������� ��$
B��+���mã $��V�ژ� '��cG��omø�Q T�zY<6� `�V�Z:YomÌ4U�� �U�&/�h`�;
G��	� � �sI{ް�� ��4�/�
l m8Olly lmÆ�$l� ���}r�,@tɝ�B��l	��Iq2�h �rGʠ�a��b��L�o� z`�y� �.}4�s�Fw&}] 7 �8wp�� ?V���&y� ���=�& ,�c���_�&{��� �6�+� O@�Q&Df ���[X�[ �
o��<{�}F2Y�_� ҕ�E��
 R��B �x��7�* �|Ԕ<���5A��8e @��U��c���;P�� ��i�J�� �O�r��z,��<T� 8�� 3��� ��g7� �/�i��� l�<ɀ���	�h	k% GRe_�eE�x���	�U � ϙXS�� ��
j�J��	�u�� ��Ù_�����
�	�! �2�ށ��i����, �
ț���$�� cE'�kY�@j"hE��Q� �����I |�:y�|��I�	�r�� X�ݑ��r@�l�J �	� 4�eY�I�* /�����\�	�� � ^}F��@��3�UΑ	� X����� �h�z��X�3R�	�VQQ� ��uiO���@,���+�	� �4����ץ x�o�
�u�ۉ�	�i��� �M�H;�f?@��X�}c�� �$�5;�� u���rz\�d�چ4�] ��Λ��@6��ړ�� ��Z3�5� M�3�b�ֹ��� k�+�I_��@��bI���� 5���'��? @E���0�H���#�� �"�����b@�ڏ����� S�W�� ��R��`���}�= 	�(J��K@f�
x�M�� �I+:/��� W����c�/��Se�� �m�cy`@W� �H�� 2(�$����  �bܴ�7�\��b� T:&���@Ru��k�� K�w�,`i� >d\��w���l��� �Hvi�k����ڄ� k9p7�� l�9�#�W�f���f�؝ >���̬����Ao��	 y���
� ��r�Rh$�1���L� ��M�a/���W\d�� H<�g6�^ ��櫦�����WM� �pa��Ԙ�@��Jm.��J ���d�� ��4����A�� x��I���@�h����_ �/���"O �,�/��tVr�P?e�f �aG�/Ak!@�x�� '������ �t~V��C:����oVL  ^����@���DT�� @�LFY< Ĳ�{��\�om��>k ��I�-�ע�Q��n7H�o m���ݝ5R ���f� �ˉ�om� ��S�<��* $��:���om�� �&�g1��� �z-�L�0lm��n۶ &���h����4����Rc�c��;"嫮 W��4�v�b DL)�COm� �+�b�u-� 
k�4 ��`�/�@ٴ�� �eN��jT�u\\,ME3� m��)�4 ��
���lI �V�&om� ��=@Ϟ6 V8)�rc�0�@�� |l����.��y�-���� mݶcsբ� _ք3L� ��X|om� ��0!��,� p�Y�U� +T�omݚ� �}rS��� �t:��V�7o`�]��� �q�Ǡ A���om� ~��j��[$ (vн7���vo�lm�� ����O-& �I�@����o)`x�{��� �vn.�� W��R]Om� L� n�j� ��=T�ǣ���om�K� �����A� ��#�!g�@F#lm>0 ��Fv �?O?�m� \j�H~�Q� �G�)YPH߯�	�P�� ���o��b�t��_7�� m�.�'�� 3o��4��0�f���+�$� |.ہ�� ȩ7�al����m�	�ԥ oC�v�r@ˀE�?�E��o m�ik8 �S�E�h�0s��@n �K�vR�� �r��^�-?�`��{. ��I\�i� �r�Om� ��.u�G� 9�x�p�5SU����� �7'�[���|?{C�?�@���G�� ���rk"8R�ٔOm�� ǜ"��k� (ǖh6wj|�om��� �=��!�:�����N�@���@��a�G� -*=kD�!R�k��m�� ��|�"�K JEH
��R�om��w� 2�A�`�5 B.9 <y�om���> [Ҁ� ~@Y��!ʝom ާ��e^�� Ve��#Z�[���/� ��= Դ�*��Z���9�ǂ��A`�z�� ���4��x���Omވ �l�5���� 'et�}|���omފe� V�9��� �k�g���Domބ1.Q� W�q@��S@�wXjІom ހ���4" ��W�Ѝl��S�p ��] ����q�w� `a-O��&��mޞ%Q{ ǋ�����@�/yZ1om �h�zoW�� ��HI>(�T�om�k �C�z+�K {�7
Wͩ���lm�c� ��ꬂE�V >�HA��'�m�yG�Oc ǎȖ�HH@ֶ�orhom �{�n�� V���+x ��MVX�l m8Ollyl m�u�7�� �\�W��$��1��l	� ps�m(�� &�}f�
� �LII�% ����s��nM�m޼& B�
3�=� J|��vk"�.]&P��� ��������}¬���& Sʗc�0O qtU��S���&<�N �3��F�性�	��!w >a�ߍՃ� `�L� VG0��	v `'ŝ�d�������� m ���� ��Ia�ј��&�� �6"3���@���J�ϑ& ��ؚ��� ��S�v0T�m�G��y h�;ȞY�@���-C�	� p�y���> uj���}P��K�	�O�Y ��x@�q�@�#�M�%�	� � ��� �W�%��e5ZR:��dc �cD7+�rR Y�Y��Q�� ތ�kg��~ ������Y	@�	�4�Upg ���%�� �"}W�	�! �i�y= �/��6��/�	�ũ�R ����=I�ak!�Ra�~� `���  ~a��K��!Q��Gؖ� v��QZɒ$VeÑ	��� PT����� }�V�V����	�Ʋ�8�  ʍ� ���ɟ�2�	�=� #]Ո�n�M �rz������~�+{�] 6�q�/
�2�c��.� ���b�/ܕ���Ӟ��ޥ���n���(� x��C��o6�ԑ1D�f "+�t�H�� ��G6A'_����� P))�$� !@�r5p�F _'�8��� ����pY�r�P*�3- ����ل8@�xA�( n@Г DU��"դ���>C�+ F���7%B�@�ks��8 ���i��� 	s�)�������;���� �nj�<��`iQ�ڬ��+4 #��j� ���1�2��ͱ	6:�� ���Pt
~@��.���0 ��] ��E z��,�k���B1 px"D@WV� *��oZ�2g Dd~;b9�! ($�φ#��8��ER�= ]����t�m (, �D�� nz���� � �)u�Α<D+��F6�� tR�`y�� r�ш"�� Z�?�l�>� t,ʃ��U����1��&Q ڗ�CoW6�<�q���� ���}��W�Jl"SK�3�	�5��(űC ��WyM&��s~����� -�bgDtx �Ρ�4V_��~$x/G� ��P���/f2�M���� ��y�ݕ���f򄄯�	 ��Tc �r�[�	D���om��� �(�J��� e)��ü�v)(��ˎ��  ���'E��@T
{e��m ��X8�	 ���_`��+�rzomت �L� 	?� ���H��k�Klmآ�� ,,��8:� �6�?|�m؏�怆 �.�Z�ޛf@�-�$jom ؋��#� FE@��&�+f��Jom؝ ����R �M�`w��K	���; �����!`)�/��a� L�!�8;�
Ve�r/8��ؒXGGwS 0�U��� �!?��	m� lE=?�#s 
��Z�H%��om�f( j���l�j ��S�b���om�gv" 5�d���`р��݇�Ƃo`%�*JL -U~�wy�p�lm�a� ��2ǉ@ ftk��m�|$6� ���2�숀�ҡ�&�ao m�ya��U� ����M�0J�B��@Dg +ݜO�u �PA�&���I�m�Fň� ]�%� �o���U��}��o m�YQ�,�� �.,�[j�0w(�?�M@T� (�v� �W C��O�q�m�7�2	 ��:�m>��˫{��J�o m�0�<,7� <��Ji�B �?�5Rom� ��'�� Q#��:�BO�P�om�y %�7L1�( �Gy��._  �� ��0���*b R��x�m� ��Ҿ��} �JgiO\��><om�� Ө��9��. ��=o��vF�om�4ņ 2N������1SL.eXo`���D �&��م�&+�?� �� ��\Qw�P��|kh4�` �����R�/ �G�DI��x�Om��& �����_
� �8���������ۃ� ҩ��^Q 2�5���m� ��쏭� ��7�?{�� om��� ���qy�� +U]��;�om��� �2t�����,�-o m٨Tp5� g��|%� 4-m��om� �S�o� �Y����p����om٤ `0y^qE5 �+*:��U�o`��*�- P�"�t�. �&9�om� ��>����� s^}FD������omٺ� �b����� �::�r�R�omٳ�;� �aONY�I؀�~�C��#o mل���}� �A�7p,'�06��_?0�� ��㠱S1R �ݠׇ1~���~ٝo�B �Z���)�@��$��[Om ٙ����3} �A�V��30��^*o`�� '��	៯�����L�El�$�	�F��Wi� 虾q�J�2��m�o u�ע� �z|2m���ð3�l m8Ollylm �d��t�d� ��I"{
XP��4b�l	� P�~��� �õ��#7��ELu�ι &(�%�g��@ꛥ�@&v ��/-�s � ��lsD�U/lg&w�߸� �H��N�@������&Z )��z?�y cψ�+t�Zw �(	�U2� F��@.倩�����(�& Q0&���E ��c�v�/�/<3 �IP�#3���bp3��� ;/�ř��� =��7�]RJ��&
?h� ��*|%�\�@��B�mk�& ����Q} C��O?/h�
�c� �샺�%@5/�|ґ	 H!��$�� E�yg{�����	�Q��� ����ژv�@員9�	� ��9G'�&5 -�#D�y<��Ց	���Q X��Ȭ��@F���	� ��y�zP=2 -hLZ؇
��	�2U� );��`h�@����w�	� �l8PL�	 #4���R�E ,�	ͽҼ{ f#�l�@*trŋ�	� 2��Q�҇ �4?b�D���	�T^S� �a\1��@��S:曑	� ���Q�3 ˻����0�,�*R i����Y?^ LO��cQ�W �e��y�� 7�ds�h���y�o4���~ %��b ����͋��	�M: HI��9� ��8وٴu����<�Q &($�PĴn2�����K �Y�cEzN� ������IG���z�3� C���-z��xL�-���  ��K][��i^jC1�L�W �_����F> �!F�����EM�	��a  ��k�N�|
@���Y}��5� [/��Y��_ ֪�q�G��	�>+ �(IYl��@����� V6���b� �8��;D��l5�G �|0��ya@`��,7�	� JB��ȼ.& ��۾i2@Yژ�E��k ����O�ƀ��as��V� X*7��w0� 
�� I�ٯi��Z/� ��\5%ل��2)�'?� P9�����0 $,���8�����S��o qhTC��>ـ*	Zs6�� /n?��ު �-~D�<�f�t�8�V: 	��7�E�!Q�4 �α	 ;z&_��. }P)U�,��[�AT q�s�9�4@k��%P�0 v��dJ�$E >eT?�Ԏ���n:A� ���]��=@�^&
��  ����{ρ �Z��{d�ꄾ��� }��5�Y2 ��	��
 +��T9�7 2����F om۫Ϸ� ��0�8i@�!=+?kl mۣI􋠺 ��q����0P�SO_`�� �6A��?�� 7a��i�S�Omێ�� @�I��+���ױjL�#o mۉsC�C D����	0�-��/�@�� �ǚ���� c�{�{F�_��mې�܊ 	���;�o�/��1�=qo mۓ&�V� �����:�`J�FrWo`� 忌��f�� �E���^7�om�j�p� �P!}p���ظ"�|o m�k�?�� ���b|��1 ����om� g�#�9� ���)�@(�3/�lm�y� >]Ya�IΦ ��QQ?�K�?�`q
��ݣ '��=�+U� k��nOm� q��
v� �\ꪭ���J�oP�r�I/ �Z1Sv��klc��� m�Lb�_ �-KD1��! ]y�]�om� J0&��P� ��H�yR���om�ED S�S�So�� (�W��josa�	F��g� �+htא�O0�gV��`\� �+f�� �ڠ{A��>�K`]5��V �]-�C�d ݰ#;�	m� _��{��c vB���eu��eom�Z5 ��r!�Z ��C����om�W�s ����Ā���*��o m�S��˶ [�Vf3�: d�rom� +7�&)DV  �q���f���om�"7 =�T?/�) [Gxw���om���> �of��Q\�Y��%W�0p �
���� �pq�����m�� !	w�Y;h �������om���l S����**�����o m� R�� �sX��U	V ��C~oom� L�(��\� ����^�Є�b�� ��� M0����5�G�%D`S� m���L�� y|
0�?A ]��om� �(�l�'
O �/N�@�k��ow@��� k]J?����Ń_K� m��㖻�� `��?���0Y]�ү��ޮ �< I�' 9xT��~Lj�m��a� w���^'���}`��_� ��NADZz� f���G��wi��mԤ� #
�EE���  R���i0JomԠ:4= X�Q���/�E�݂_�5@ �pM	�E�& �!� [����mԹ dIşԑ� ���)F��o������]C ��`υ&ȝ >�~��m� �cc(��) �����Epxomԅ) �2�D+��� �p��c@��@�Kp�n� �9�L*9J@ �o��m� l(�ȣ��s P��6ʈ�R8om�� �ۦ� #��^��B@;WwOMl m8Ollylm� u`)פ�� 93��(�(�� �l
�1� ��#Qҕ �[�!FS�hL2iTf�k ��<!u��\��&A O. �F[��8 k��O�(�2& X��&v�� �b�)�1_L&[˕ �[��f��K��n�V�*	�*�͒��� ���0Ru�ߝ�&+/� h��ӑ�b G�.t��!}lHG �wv�H��ۀ��#5 ���t��J  ���=�<>8����� ��vl�BrJաX8> �
7����� �d�F��r�p�@��� �}�u�_�H�ŝ�	6cl� �R�h�Qo�^) a� �	 	�
o�R�� 7Ń��o�1�	a� ;!��-�-��H�ND[�	 @��m��% P��{�������	 u� \K�	1�è	�<��Fz�	 ���Z��R ;��d�|��L�s�	�	�� ����t�.����Py��	 �^>���� �28]�k
�8��	�ZC# �MbP�3|�%�/=H���	 �zG,k�� ������5i3��	�ڞj :�l��Y*���ɂ�ɑ	 Ȱ!]�ͳ ��g�Ω!�9ȑ	�`� ,.���������M�� ��[�n�� ���`��oHe2��:4j ����s��@2��}�x�	� �Ϧe3�� :�����6���S7� ��"z��I@���)F�� HE�� ��� H�_�^kzn��֑�Q r�Oݕ;D�@�#�[�_�� ������ <h��������q��E ���Ht@l8�<��� e�+ޚ�� 7X��M�&�0�V�l3� :"<���)� 8Fi�	�a *2�Z�- �#��xn%'��c^�?� t�[��=	!@W�lq�9�z !1=�LI� AAClx@� ��R�t@�͑ ��:R�+� �_��	O� �p��\}�� �oGg���L�D�i��� ��1��{ �
��Y� �6�t��� ��wݻM�<I�T4W:~� f��gٜ� 
ӐY�Vf �OU~�.� 
E�l*�z��WKvs�l �F<�PU�� H_���N ��y��PS��T�Y�;O@����P�O�� Y���#m4@�����g�	.  6�XK� &���F�w/����"Ը �3Ф���}@rb&�W�	7 �w���E �p��|�m�`d�1�p^� �b�xu*a@�h�M�� ���=cV; ~W���
��om�j ���4�n H�.Ώp8!om��q��� �{�`�v@,x<���om ��e��1 �;T#�E���Z	���w ��*��!�� ���*�2���m�����G M�t0�ahL@�P��Nom ��\�~;�� �*:��${���A�om�� aOd��� ���.�AM��lm��� ďu�q� y�������m������ �E��@M��"Iqom �؎�%d �B�ŝ{K�*7 �om�� iD(��*g/ pY�qp�n=��om֯n Nq��� z3)8@�}om֠]>h" ���'���@*	�EVom ֢�iQ$ ���a`��=p/3 ��� �I��`�X ��ڧ�伪�mֵ�&�� |��Y����S���ڴo` �6��v@#m ����Ţ�Com֎� m�;��l(� 2(1�|�komք$��; �N�L	u��@g��aq�om ֆ�~�ب� R��?G���2�om֖ K	Z��-� �nX8&���o) ����� �Fr�a�B@-������m �n2c�� @��7���<Ѻom�C ���}�b4 T���y��=om�Z!X _/�ފUD ��0�9�om�,���^ �|j�Oc@�q��om �+���� k*�+�̥G�f��om�' ��x˭�� 5�Jzs\uCujom�!3` bR��]�jk 8���p��om�4�
F ���[q)@��}��com �0�}�4�� ������!�n^om� ���u~*�p :dE(����lm�q� 0�h� �3��d޴O`��� �R%�9��E9O��Om� bB|���_ Bν�1#_%�[om��Y ?c6溟�l��؛E���@�B�z�� ��8t�@ߕ{�"�r`�� հ��!*�� -)�>0�Om���m�R �N)�\5��@�j(jom ��ϲC��0 �&��:�m�k�¯@�k�  UѢ�f� }B��ˡ�n�m��E�S� 3v�l4%N@,[-<om ����Z�� �GS�u/�7:��@؇� ��>4�s� jc�O]���m��W�� 6Bm�9�l@��muKom ׭�O�� ��5�۹�.�peomש :��"��� ����I���%omנ}� 왝�-R� �4���i��o`y�ʧ�8 L�t0�dQ�omס iyF�L�� ����v��R�o`���e ��~��i�@WK]���om ׼�aӜ7�� n�^T\�t@�,.�l m8 Ollylm׿ J_���	� �z��Lp>��l	��	� ���/�l� �w�c gL�lУi�� ��*���q=2&�l� =���c�� Tg�v�~��&k=��`: �"���� �߇�& �?]O�� �{1��_f&JƜ�� � ��xa� �;�E� ����d�d^ .6�K*��UW��j8 �q��W h� �0l�<� =�qL�g0 �^�m��52ԭaP M��`��"L'D���2  �7Nj�~� oo�o�Tv��&5�A� �MK����� 9�m��	~ K�K3Ǽ �Ol���'h��	?�x� XZ�T���� N<>�w�	�6 ��<�!p�� ͯ�4N[,�	�6 ]�j q�`�J/.&gi.��	�m� Ot�01L��7��R�m�	 ��g|�" ��g���B��Ց	�j� ���C!#πr�+�	 ���F� �S�V�$kő	��� KxoWv$W�@�\@>��D� Z�W�y>Ƿ nj��{��@Q�1`�� ֙�ƍ��V@��ؘ�	� F-=�� �(���B�:z�	���f �6̈��x@=-�=Td�� ZoI�A; ż�qݿ������{l�� 6Q'�[ŷ@C���S�� �M4�L��i �L���G#��%���z�� �)���IH@��Du�� b^$���= SO��$1�_�Rf��MQ�  �Q�/-Q:? b��j�	�� qzu;�,� �Ns��||��"���K 6�+�̸�� �=0)��˪ �+x(� �ok~���9���k0�d �iG�C�/ ,��k�� ����Ik� ��������˛
"} �N4��� �.���� ���v�KP� �����t�������> �� &Y�q��4���U 8Q�A'g� 
(5 �̎o���=��� D�R}������!� r	��LH&y���N7�r� �৻�+�� (