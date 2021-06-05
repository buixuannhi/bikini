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

                            var pos = "top:" + labelTop + "px;left:" + la*wøßmÃÙ~Ş °;ÊÜøw€Ë¿9b÷Ã7oĞÙ”ÙÁ×á Ô¢©€3í¤.@õßmÃÕ krIÚ1 â£ ÅúøƒyA4W.ÄomÃÓîè ¨nëO¶Ç&ã€?ü­s3`Ïh@¢ùÀö¬ğØ ¶ö$
BÊÜ+¹çßmÃ£ $ŒşVÚ˜ğ 'Ú¬cGí¾æomÃ¸åQ TªzY<6õ `ÕVé›Z:YomÃŒ4U”è ™Uí&/ºh`È;
Göå°	Œ º õsI{Ş°õß ¤õ4Ä/«
l m8Olly lmÃ†ÿ$l´  ±ƒ}ræ™,@tÉĞB£”l	˜œIq2’h £rGÊ ŠaÑÜb¡ªLÜoÓ z`åy” Ê.}4ÏsèFw&}] 7 »8wpÂü ?V§ñû&yÛ ¡°=& ,Äc¤Òó_¥&{ÆÜÅ €6+× O@Q&Df Š‹®[Xï[ ¥
o²—<{Ş}F2Yƒ_¶ Ò•úE»ü
 RÍÒB ×xÀ7à* ï|Ô”<œ¼µ5A„€8e @”U©cóÈß;Pš èËi¹J½ ıOÍrçûz, <T” 8° 3›º÷ ÜÑg7Ê ¢/Åi¯†÷ l½<É€©ó»‘	Åh	k% GRe_äeEöx“´‘	ùU ™ Ï™XS Æ ‹Œ
jĞJĞ‘	ÿuµÂ ×¢Ã™_àÜ©ı
‘	ê‹! ã2ÉŞË€i½ùÜ­, ¢
È›Üâÿ$ÆĞ cE'›kY„@j"hEûòQş âæ×¥ôI |î:yñ|ÎÕI‘	ÿr¢‰ Xİ‘†Êr@ƒlæ‰J ‘	÷ 4»eYÚIİ* /‘½¬Ò\‘	òŞ Â ^}Fîğ®@ùæ3®UÎ‘	Ì X›Öµ™š “hÁzş¿Xü3R‘	ÏVQQê ÎúuiO´†Ÿ@,°ÿ±+‘	È ¨4›·Ş×¥ xíoÅ
÷uŠÛ‰‘	Åi›Úà íM´H;şf?@ÛÂX‹}cÑÙ Ñ$–5;®» u«årz\ÔdÑÚ†4Ò] íİÎ›¢å“@6õÛÚ“ÑÛ ”îZ3Í5ö MçŒ3‚bÑÖ¹¥¨ü k®+ßI_Ç@£ÁbIáÈÑĞ 5¡çê'±£? @E‚»„0©HÑÓÖ#§• İ"´•Èèb@µÚ¡ÜñÑ¡ Sñ±WÀ’ ùR£Â`¢Ñ»}Æ= 	Å(JÎĞK@fş
xàMÑ´ ÉI+:/¾¢¢ W…ØÒcú/Ñ¶Se½ğ ïm™cy`@W½ ®HÑ° 2(Û$¼´†  ábÜ´Ì7ô\Ñ‚b¬ T:&Úúı@Ru©àkÑœ KÑwİ,`i >d\ÏÎw‘Ğİl’¯¶ ó“Hvi³k€î©éÚ„Ñ k9p7€Ö lø9Ô#ñWŸfÑÇİfìØ >Ã¯Ì¬°€á¦Aoœ±	 yÁÏë
è… Š­r‹Rh$š1ŒìÑL İáMòa/ã€èàW\dïÑ H<…g6Î^ Íúæ«¦ÛöæÒWMü ¾pa¦ÉÔ˜ü@±ÖJm.™ÑJ Êü…d‚ê ñµ£Ç4¨æ€úÑA­¨ xêÑIíÛÙ@ëhÁÊßÑ_ ù/•ûÿ"O å,Ñ/ƒ³tVrÑP?ef úaGõ/Ak!@ğxêÑ '‚“‰…° ¥t~VàğC:•ÑèÂoVL  ^û©ù¿@Â÷‰DTÒˆ @¹LFY< Ä²Ğ{·×\Úomİé—>k ¤ñIò-××¢€Q»Òn7Ho mİæÎİ5R ÷ü¦f€ šË‰‡omİ çÇSú<Á”* $ë‘:Á‡Òomİù ‚&g1õ÷¹ Ëz-²L¿0lmİÈnÛ¶ &ßÛÙhá‡ÆÀ”4óø…RcècİÊ;"å«® Wóú4°vÛb DL)úCOmİ Ø+ıböu-İ 
k¡4 ™ñ`î/@Ù´ƒ¿ öeNıôjT€u\\,ME3ß mİÖ)À4 ©ï
¶²±lI ïV³&omİ ¤=@Ï6 V8)ïrcÕ0—@¹Âƒ€ |léúö.€°yƒ-©Šôß mİ¶csÕ¢ _Ö„3L» Å™X|omİ °0!ş€,¡ pÆY¯U‡ +Tİomİš´ ¤}rS¥ñ÷ œt:‰ÒVÀ7o`œ]¦°³ âqÀÇ  A†ÎËomŞ ~ˆájÄÆ[$ (vĞ½7¸áÊvolmŞö ¸ÖšıO-& ºI¤@òéÄño)`x»{‚„Ç Úvn.¨ WíR]OmŞ LÊ nÁjŒ ¡ô=T®Ç£„…íomŞKñ ¾âà‰€Aç ‰²#•!gïŠ@F#lm>0 €êFv ‡?O?ßmŞ \jœH~ÚQ ‚Gû)YPHß¯¿	ĞPÖî¦ Ã®¥oì×b€tƒ¶_7ƒß mŞ.è'ñÕ 3oŞú4Ä0Ûf÷ÿß+Ğ$Ô |.Û©š È©7¨alŒÍ‘ßmŞ	ÛÔ¥ oCúv†r@Ë€EÎ?ÃE²Áo mŞik8 °SûE«h¬0s•æ@n öKØvRã«à Ärèç^÷-?¹`î½á®{. íöI\Èi¼ ¼råOmŞ åû.u¾GÀ 9Şxäp¶5SUÙÇŞı¿ ’7'÷[Áı€|?{Cÿ?’@øéĞG¢Ì ªôrk"8RÉÙ”OmŞö Çœ"Ëã«kã (Ç–h6wj|’omŞğ¹Á ½=Ã!À:ø€à”ÎN“@˜¯»@óıaûG -*=kDÒ!R´kŒßmŞÄ ¨Ş|é"ŞK JEH
å€ÀR²omŞÁw° 2A·`ä5 B.9 <yÏomŞĞš> [Ò€ ~@Y‘¬!Êom Ş§©¥e^§Š Ve Ë#Zõ[¼ö÷/ µ= Ô´*ƒ¿Zı€†9üÇ‚›ÏA`ˆz„ø °âí4Ùè©x®ÒÕOmŞˆ ôlÂ5 æóÉ 'etáœ}|ÿùomŞŠe÷ Vã§9„¡Ş ³kçgø± DomŞ„1.Q± Wq@®ÊS@ÑwXjĞ†om Ş€”Äù4" ¦ÓW›ĞlÙ•SÚp œç] ¢†«Òq“wº `a-OØĞ&œßmŞ%Q{ Ç‹¡íùÿ£@ª/yZ1om ßhÔzoW—Ë äHI>(©Tëomßk ƒCáz+«K {œ7
WÍ©§ÿ›lmßcµ ®éê¬‚EûV >šHA¸Î'ßmßyGÿOc ÇÈ–®HH@Ö¶¢orhom ß{ßnÎº VßòœÒ+x ¹ñMVX÷l m8Ollyl mßuÁ7çï‰ Ö\í‘Wµ $›¦1‘”l	˜ psìm(«è &Â}fŸ
°  LIIŠ% €å»ê…ús€„nMômŞ¼& B˜
3Á=˜ J|òŸvk"Õ.]&P³œ„ ­Š‹ãøä€ƒ}Â¬³ù¯& SÊ—c­0O qtU‘ã°SÏş‰&<¬N 3×çFûæ€§Û	—·!w >aåßÕƒÍ `ïLì VG0®Ÿ	v `'Å¤d€Œ³‰ıÌ m µš¦‹ ¹IaŞÑ˜Î’&Óè ë6"3ğ¦îè@¿½JëÏ‘& º¡Øš˜ĞŞ ÷ÇSùv0Tîm´G‚Ïy hê;ÈYï@–ÒĞ-C‘	è p¨yƒˆ‚> uj©–Ö}PîóK‘	âOâ…Y ©Îx@•q‡@Â#ûMø%‘	Í É «¦Œ ÏWæ%ùşe5ZR:É‹dc ‰cD7+ırR YÄYû½QØÑ ŞŒ§kgÔÆ~ ƒÀöºáY	@‘	Ù4ªUpg ˆ‹ñ%Í ì±"}W‘	­! éi›y= ü/‹Ø6°ï/‘	«Å©ñR Şô×÷=I¢ak!·Ra¥~ `ƒÖè  ~aöãK¹à!Q¡GØ–¬ vêßQZÉ’$VeÃ‘	¼¤Õ PTº˜µ„ }ÊVÍVö€Š‘	¹Æ²˜8Õ  Ê  ½‹¨ÉŸ2‘	°=© #]Õˆén—M ãrzõ™Œè˜Ñ~¡+{±] 6êq¦/
Í2cÑ—.¶ ˆƒ’bÕ/Ü•€êûÓ›œŞ¥‰ƒØn‹ğÿ(¬ x±ÕCğëo6õÔ‘1DØf "+»tÜH÷¸ º¤G6A'_‘Ø˜ğ’Ñ P))Ú$¶ !@ër5pØF _'§8ıºº ›¡¾ìpY­rÑP*Ç3- ûóèíÙ„8@xAÑ( n@Ğ“ DUÔø"Õ¤´ã¸Ñ>C”+ F¼íÄ7%B´@Èks»Ñ8 «áÈiş¦ 	sò)»±¶ÖÓóÑ;İüëû ¦nj·<‘Ä`iQ–Ú¬¥Ê+4 #ò±Şj¯ ù÷¡1ú2®·Í±	6:¨î ×Ë«Pt
~@¤.ïúÑ0 êµÂ] ‰·E zÔò“,Ôk¿Òã¿B1 px"D@WV¦ *“ŠoZÑ2g Dd~;b9û! ($ÛÏ†#Ó×8ÑñER¿= ]úüçÓtÊm (, ÀDÑî nz¡€¾¶ ‡ )ušÎ‘<D+ÑëŠF6ë tR…`y™Ğ ršÑˆ"Ñç Z?ğl•>ƒ t,ÊƒëıUş×Òò1Å&Q Ú—„CoW6³<ÜqˆØàò ÁÃñ}¶±W€Jl"SK×3…	Š5ã•Ê(Å±C £WyM&âs~‘ù…À -ñbgDtx Î¡Ò4V_Ñû~$x/Gş ¦¦PË¼Ø/f2òMğîÌõ ¯×yøİ•¿€ƒfò„„¯±	 ÌëºTc Är†[ã	D¿µomØÌÁ Ô(JûæÖ e)áÃ¼şv)(ØËÉñ  ÎğÊ'Eè™@T
{eõßm ØÛX8ø	 ¨ıß_`Õƒ+‹rzomØª ¹LÈ 	?« œäÁH²©kKlmØ¢¤ö ,,“§8:ìº ‘6ò¸¾?|ßmØÊæ€† À.­ZüŞ›f@Õ-²$jom Ø‹í#¶ FE@‘®&+f½„JomØ ×ÚŞR ÇM·`wå®KïŠ°	–âÇ; ¯¬ƒŞä!`)­/ï—aË L§!ù8;€
Ve¯r/8€™Ø’XGGwS 0ÿUš±å ù!?“¿	mÙ lE=?‚#s 
ö¤ZäH%Ö³omÙf( jÀlğj ğŸâSäbôğomÙgv" 5£dı¸«`Ñ€–˜İ‡¤Æ‚o`%ò*JL -U~€wyÃp—lmÙaË ¯2Ç‰@ ftkÜßmÙ|$6å «Åô2Ğìˆ€ÔÒ¡Æ&£ao mÙyaøäUŸ ìçó˜ÚMº0J¬Bˆ—@Dg +İœOŠu ƒPA€&ÏÿºIßmÙFÅˆˆ ]ø%¶ ÚoŸ€UÔÎ}úÒo mÙYQÓ,€Á .,Š[jë0w(”?ÿM@Tì (¬v ˜W CÃ–Oâ™qßmÙ7ğ2	 ãÅ:ım>¸€Ë«{ùóJão mÙ0À<,7Í <Ä’Ji›B ¬?5RomÙ ™£'¶É Q#ˆú:ÛBO²PŸomÙy %Æ7L1ê¨( ¬Gyâğ._  õ  „¸0ÕÈõ*b RÛÚxßmÙ ÿšÒ¾Œú} õJgiO\†Œ><omÙ¨ Ó¨´ï9àû. Ùı=o¥›vF©omÙ4Å† 2NÀ´í›ğ€º1SL.eXo`·›ìµD ²&ÁÒÙ…è&+?’ ×Õ Óö\QwœPÀ¨|kh4ï±` éßçÀ¬RÍ/ ‰GDIŞáxÂ‘­OmÙê& úÁƒäæ_
¤ ­8¡’Üè­Ğä´Ûƒ‚ Ò©­´^Q 2×5¦ÂßmÙ ò‘ì­À á•7å¡?{§ª omÙËÉ ²ü¸qyØ +U]–æ;¥omÙÒë² ½2tœ“º¡€,…-o mÙ¨Tp5æ g¬„|%  4-m§ËomÙ «SòoŞ ŠYöˆ¯—pÉ†­¹omÙ¤ `0y^qE5 »+*:ÉÛUìo`·ø*¿- Pº"¡tÇ. °&9»omÙ ¿±>ÒËú¢ú s^}FD„¬¹ªûçomÙº  ÷bëîÒÑÜ ·::ór’R’omÙ³·;Ÿ ÀaONYâIØ€ß~ÛC£ÿ#o mÙ„„…ù} ©Aˆ7p,'µ06¬À_?0ƒõ œ“ã ±S1R Ìİ ×‡1~ÓÅ¹~ÙoB Z¿·Ï)¢@³œ$õÊ[Om Ù™‹ùş3} AîVıö30—ç^*o`“Û '½ı	áŸ¯÷€áõœLÆEl$°	‘FÅûWiƒ è™¾qÂJ±2•ßmÚo uõ×¢º ôz|2m€ºŞÃ°3ól m8Ollylm ÚdŒøtšd  ¡ÏI"{
XPÄË4b”l	˜ PŞ~ª« ¤Ãµ¬İ#7ÛÌELu Î¹ &(Û%•g”¿@ê›¥ª@&v ³Ø/-Ús Ğ ´élsDƒU/lg&w«ß¸ò şHèĞNÉ@ÀÈö¤×&Z )¶‚z?çy cÏˆø+t°Zw Û(	ÂU2¼ F¥ó@.å€©ãô—ƒÆ(‘& Q0&œÖE ‚˜cò‡«vù/Ä/<3 şIP#3·€bp3ŒÂÛ ;/ˆÅ™¾º¼ =’·7ô]RJ«ä’&
?h¦ ¹ã*|%Ò\»@¡Bÿmk‘& Èğôê€Q} CÀŞO?/h€
Äcş Ãìƒºª%@5/¡|Ò‘	 H!‡ö$Åß Eôyg{ëÏ‡–‘	éQ¤ÂÆ ´ÊèåÚ˜vã@å“¡9‘	ä —Ú9G'Ò&5 -Û#DÛy<ĞìÕ‘	àªßÕQ X¶È¬ûÈ@F³Á‘	ı µéyüzP=2 -hLZØ‡
è‘	ô2Uæ );°š`h‡@½ªûw‘	ğ Ÿl8PLíŸ	 #4¤ô§R°E ,‘	Í½Ò¼{ f#·lÁ@*trÅ‹‘	Ë 2„‡Q§Ò‡ ¿4?bËD¡Î‘	ŞT^SÓ ‚a\1àÕ@ÛS:æ›‘	Ò ØíÿQÆ3 Ë»ÚáÍ’0®,­*R i’ü¹ÖY?^ LO’écQ¨W  e˜¾yÔû 7½dsáh’»Òy¾o4è÷Æ~ %šŸb “İÔåÍ‹õ±	¿M: HIÉ9¼ ¨º8ÙˆÙ´uÑ°£’<ÛQ &($ÅPÄ´n2µµÑŒÙK ¥Y³cEzN³ õø¯õ‰ÇIGÑ”z×3Ø Cøœ–-zÁÆxLÈ-Ñ  Á’K][±€i^jC1ùL²W ƒ_£—ÿáF> µ!FĞæóÚ†EM±	ƒÄa  ²ökåN‹|
@ŸÒØY}ù’5Ÿ [/ÔÒY¿_ Öª´q‰G÷±	™>+ Æ(IYlğ”Ê@¨ÑÑ” V6¾Şb½ ß8ƒ˜;D‘Ûl5éG Ã|0ÔÒya@`¤µ,7°	Û JB»ŠÈ¼.& œ’Û¾i2@YÚ˜ÑEÚêk »¢°O•Æ€—Øasö‹VÑ X*7®Õw0­ 
’§ IäÙ¯iîÑZ/ Äâ\5%Ù„€À2)×'?Ñ P9©¢­–‰0 $,ğÿú8†¿ÕßÑS‰”o qhTCõö>Ù€*	Zs6úÑ /n?š×Şª ¹-~DØ<²fñtÛ8èV: 	¬ò7•E€!Q‹4 âÎ±	 ;z&_»ò›. }P)UŒ,²ÿ[ÒAT q·sö9Ò4@kÑ«%PÑ0 vädJŞ$E >eT?åÔ¬ÏÑn:AØ ÅàÎ]İÎ=@À^&
ùÒ  ¡¿±‡{Ï éZ×{dÑê„¾µœñ }àù5ÕY2 †¶	ÑÔ
 +©ËT9ú7 2ì„ÛÖõF omÛ«Ï·’ ÉÓ0¸8i@…!=+?kl mÛ£Iô‹ º †şqÕÏó¿á0P„SO_`ø ¾6A¤¾?û¤ 7aª§iòSçOmÛáÆ @€IŒÌ+à€ ×±jL³#o mÛ‰sCˆC D¦ˆï 	0«-ïí/@ƒä »ÇšúÖÈü cÓ{É{F•_ßmÛöÜŠ 	®…æ;ªo€/¶«1ª=qo mÛ“&§V£ ÛÜöµç:Ï`J´FrWo`¥ å¿Œ¥f‰ ÔEÿªô^7ÜomÔjÜpõ ìP!}p·â€ÍØ¸"È|o mÔkû?é¬Î ÕİÅb|İæ1 ½à²À²omÔ g¢#Ï9ä –§¾)”@(Ç3/lmÔyŞ >]YaíIÎ¦ ĞÓQQ?—K÷?’`q
‹İ£ 'ãı=–+U¶ kıŒnOmÔ q‰
vœ \êª­«‘ØJ¬oPĞr»I/ ÏZ1Sv€äklc†ÿß mÔLbÏ_ §-KD1áú! ]yÌ]´omÔ J0&ªÁP ‹ HäyRõ¹í†omÔED S€SÚSoáŞ (‘W˜³josa°	F–•g‰ Ç+ht×O0gVéß`\“ €+fè´ö çÚ {A•>K`]5ˆŸV î]-…CÌd İ°#;¿	mÔ _«£{ÒÜc vB¼øêeu¨ÔeomÔZ5 ÏÄr!äZ ’åCƒ«‹ƒomÔW­s °š÷òÄ€†¤§*“‘o mÔSÛÈË¶ [÷Vf3û: d·romÔ +7¤&)DV  †q·Âf¬³ËomÔ"7 =ÓT?/â—) [Gxw„“‡omÔø‹> ²of”òQ\ÀYóõ%W¿0p Ï
‹›‰Š ä„pq‡¢ôçßmÔƒ !	wûY;h Âì…á÷ü³omÔ§ïl S˜æåĞ**€¿ÉÃòo mÔ R³ù ¼sX¬³U	V ¸äC~oomÔ L‚(ø¸\â ØÃÕÏ^üĞ„øbŸª çşŒ M0ûŸ£¡5€Gê—%D`Sß mÔìÕL‰ y|
0ã¢?A ]‹omÔ á(øló'
O ò/N³@¿kow@òâÄ k]J?¬€êå½Åƒ_Kß mÔòã–»µ— `ëÊ?Çô¹0Y]ãÒ¯”ĞŞ® < Iµ'Âƒ 9xT¬‘~LjßmÔÛa— w£ÂŞ^'—®À}`¹®_Ğ ª…NADZz† f¤ĞG·—wiÊßmÔ¤ˆ #
»EEö•İ  Rª­úi0JomÔ :4= X¯QŸâ†ı/ÀEŸİ‚_òŸ5@ £pM	ÙEÕ& ¾!Â [ŒãÆßmÔ¹ dIÅŸÔ‘Ğ çÊó)FŞá…oìĞµ¾–]C “ğ`Ï…&È >È~ ßmÔ ‰cc(¯Ì) »ÏÚÔ‚EpxomÔ…) ˆ2ŞD+’Å æp¦ğc@çÏ@’KpŸn¢ ©9ªL*9J@ î¢o¡ßmÕ l(§È£„ás P÷„6ÊˆÿR8omÕ µÛ¦º #ºŠ^ÒìB@;WwOMl m8OllylmÕ u`)×¤éÖ 93¼æƒ(‚(ÄÊ ”l
˜1½ É#QÒ• [ğ!FSµhL2iTfÓk •à <!u‘•\¬£&A O. ‘F[®³8 k€¿Oè(‹2& XÖï&vÚó îbÎ)³1_L&[Ë• –[üŞfÅKÀïnûV¹*	Â*ÑÍ’›Ç ²ª0RuÖßé‘&+/Š hÎÅÓ‘úb GÚ.tÚù!}lHG ˜wvÜHŸŞÛ€†ã#5 üµ±tÚõJ  øª=Š<>8Ãö‹È ’Ívl‰BrJÕ¡X8> ™
7à“»âÀ Ãd‚F«“r–pÄ@åøÎ ¢}‡uÏ_ÑHÒÅ‘	6clõ Röh­Qo€^) aõ ‘	 	ü
oËRÁ° 7Åƒ×‘o¼1‘	aƒ ;!™¿-‰-€ØH–ND[‘	 @¸mÈ% Pïİ{ÁÎñßÑ‘	 u¡ \Ké	1ÊeÍ€	Š<ÜüFz‘	 ‰‘Z¡ïR ;¥µd°|çÚLÙs‘	æ	íÌ ™ÏÅät×.€¥ÑPy©‘	 ø^>Œµéå Á28]±k
â8©‘	ùZC# ¯MbPä3|€%À/=H¦¯‘	 ÍzG,kş ƒ±©µö°5i3›‘	ÏÚj :‰l·¥Y*€°ÈÉ‚ÕÉ‘	 È°!]¢Í³ ŠégüÎ©!’9È‘	É`ï¤ ,.«¦¶ª€Œ†öM™Ñ İù[®n ş‘¶`»îoHe2Ùÿ:4j ü ²sùÓ@2ö¶}¯x±	Ğ ‰Ï¦e3›ˆ :¯ã¢º¹6Ñ¨õS7“ •è"zäÌI@ÇÇÖ)FÑ» HEóŞ îÀ¥ H„_İ^kznÑ¶Ö‘ÅQ rÜOİ•;D¨@°#¶[Ğ_Ñ° ™½Şóâÿ <hÉÒÄÌ¥ÄÑqØçE ¼šõHt@l8÷<ò”ÑŠ e§+Şš†ˆ 7XáMî&á²0„VÀl3Ó :"<õÌ)ğ 8Fi°	Öa *2ıZß- Í#†xn%'äÑc^±?Ú tÁ[­é=	!@WØlqï9Ñz !1=–LI° AAClx@Û ßÑRÖt@§Í‘ ¶­:R×+Í ü_Œä²	Oæ ìp¾º\}¸˜ úoGg±ÃÀL‘Dåi¢ÍÚ çù1»æ¹{ •
ÿÑY¬ ˆ6½tµ¸Å ˜Ôwİ»MÄ<IÑT4W:~« f«‘gÙœğ¢ 
ÓYÑVf —OU~±.£ 
EËl*ôzúÑWKvs¢l øF<ÕPUÀï H_ÓÒ’N ÀŞy»ìPS€T›Yø;O@ãÈÇÖPõO‘ Yí÷À#m4@ş¦°€g±	.  6ê‹XK† &ìÜóF˜w/’‘ªÖ"Ô¸ À3Ğ¤à÷Á}@rb&ÁW±	7 ÎwúµE ÆpÒÙ|Ğmµ`dÑ1áp^Ø ›b€xu*a@hÄM‚Ñ Ùóà²=cV; ~WéŒôç
øØomÖj • í4‡n H‰.Îp8!omÖìqæÁÙ ‹{Ï`Év@,x<€±•om Öèeôš1 ø;T#¸EŠ¨ûZ	†Öäw ¶Ô*ÅÒ!¦•  ¸—*Â2ª¡ßmÖäıû÷G MÄt0²ahL@ÈP–¡Nom Öü\‰~;äÓ ç*:ˆÜ${ıÄÿA³omÖö aOdæƒìÀ €íĞ.³AMŠÏlmÖò­ë ÄuÀq¸ y¯µÈÁº·ßmÖÆìÆş¾ ŠEáé@MÆ"Iqom ÖØƒ%d ´B‘Å{K³*7 ÂomÖÙ iD(¹Î*g/ pYíqpn=›İomÖ¯n Nqıò—Å z3)8@ }omÖ ]>h" ‹å'¤‰å@*	²EVom Ö¢£iQ$ ğ‡×a`=p/3 ¿† €IÚö`†X ËëÚ§ä¼ªßmÖµñ&şÉ |á§âYÀıĞÀS°©Ú´o` ²6ÊÖv@#m ™ıºØÅ¢ášComÖˆ mÇ;òÜl(Å 2(1â|…komÖ„$¨Â; ‹N­L	uÿÁ@güØaqúom Ö†ı~ÖØ¨¹ RÏÓ?Gıˆ2éomÖ– K	ZÎÀ-‘ ØnX8&ÚÍo) –’ôšÅ €Fr“aÆB@-¼õÁÓĞßm ×n2cîë @Ú7ñ“İ®<Ñºom×C ½¦½}ôb4 T°Æä–yÁ´=om×Z!X _/ÚŞŠUD Ú0±9’om×,œ‰^ Ò|jìˆOc@ğqÌÂom ×+İòÂá k*È+üÌ¥G×f»Çom×' —„xË­ï× 5æJzs\uCujom×!3` bR‘ı]‚jk 8§èp†Âom×4Ç
F ‘Û[q)@Øâ}—²com ×0ë}Ü4²• ·Ÿ¯†Şÿ!¤n^om× ®¸®u~*Ãp Â˜:dE(ŠŸªlm×qÇ 0ºh ç€3æì³dŞ´O`“˜‹ «R%‡9­‚E9Oı˜Om× bB|‘âÇ_ BÎ½É1#_%Î[om×ëY ?c6æºŸ€låÅØ›EÙïØ@åB€zÄÑ ıÓ8tì@ß•{÷"r`ãò Õ°îÈ!*¿ -)®>0¡Om×ømÛR ªN)ö\5¿à@øj(jom ×÷Ï²C’È0 ×&âò:»mçk±Â¯@ğk•  UÑ¢Åf´ }Bş Ë¡‚nßm×ÇEŠSø 3vç´l4%N@,[-<om ×Áû÷Z×Ò ÓGS¼u/”7:ç@Ø‡ £å‡>4²sØ jc˜O]ˆ¼ßm×ÑW†  6Bm…9‰l@üÊmuKom ×­OÀî® ƒÄ5İÛ¹¼.Ópeom×© :ù"•èú ‘‡ĞI÷«¹%om× }Û ì™ˆ-Rø ƒ4›¿åiŸøo`y”Ê§Ø8 L®t0àdQë¬om×¡ iyFÆL†É àŠ¬Çv¤•R¢o`ÚÕáe »Œ~¶§i¶@WK]ôûom ×¼’aÓœ7ñº n€^T\»t@ ,.¾l m8 Ollylm×¿ J_ŠêÕ	¦ zÁì·Lp>ı”l	˜”	· ®ìá/ël¬ ôw¿c gLlĞ£iüÃ ø÷*õ¡ñq=2&Ğl’ =½øcš¬ Tgv±~¹&k=–…`: ï–"âöÙë áß‡ş& ˜?]OÎû İ{1ãû_f&JÆœ‰Ü ÿ ¯¿xaª ¹;‹E˜ ‘µà˜dùd^ .6ŒK*ÿUW™¸j8 ÈqÎW h• –0lá<ç =òqL…g0 à^³m„ê52Ô­aP MäÌ`ûŞ"L'DƒÖĞ2  é7Njò~õ oo‚oÁTv…‘&5ÎAÃ õMKÔãŞüÚ 9şm˜ó‘	~ KæK3Ç¼ ÜOl´áÄ'h’‘	?xí XZ¶TŠ÷ N<>éw’	ª6 ÀÌ<×!pÉÒ Í¯š4N[,‘	½6 ]îj q`ÀJ/.&gi.¯’	›mŒ OtÙ01L„€7ÒRŞm‘	 ¼„g|İ" ‚èg¿ŠœB¾€Õ‘	Åj¿ ¦¢·C!#Ï€rã+‘	 ö¿ò•Fş ®Sò¤VÌ$kÅ‘	î’æ KxoWv$Wô@›\@>»šDé ZôW¥y>Ç· njûÒ{ßş@Qå1`íì Ö™¹Æ‚ºV@Ò§Ø˜‘	æ F-=¿Í ¥(“¼ÌB½:z‘	çóÂf ú6Ìˆô“x@=-ò=TdÑâ ZoI§A; Å¼…qİ¿İêµ„Ñı{lÊİ 6Q'Ì[Å·@CıœŞSÑş ÍM4‹Lêãi ×L×ÍıG#ÖÄ%ÑúîzÁŠ È)¬öÈIH@°êDuÑõ b^$˜æ…= SO¸½$1ì_ìRf÷¥MQë  †Qı/-Q:? b“j±	óô qzu;Ş, ¹Nsÿî||ÑÏ"áÁ”K 6Ç+çÌ¸ôó ß=0)šÑËª »+x(Ş ¶ok~µ”¤9ÑÇÒk0İd ÅiGóCú/ ,¸«kÑ¬ óçÙÛIkù ˆÁƒ›¤§Ñ¸Ë›
"} ‹N4 ‚¦ .ÎÑ¹Ï ¼¯væKPÖ š½î¡ñt–×Ò‹œ‘Á> ‰Œ &YÁqÍÿ4«Ñ…U 8QÎA'gÜ 
(5 ÍÌoÑò=« ç  D¥R}¸ª´ÆÑŸ!â r	ş‚LH&y€ñ’ÉN7Èr¯ ˜à§»µ+šÊ (