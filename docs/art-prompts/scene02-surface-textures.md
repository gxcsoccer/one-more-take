# 第 02 场第一批贴图

内置 ImageGen 使用了以下三张设定图，依次为[桌面片场](../concept/tabletop-set.png)、[发条鸭](../concept/wind-up-duck.png)与[纸板楼](../concept/cardboard-facade.png)。每张首稿的提示词由共同描述和对应的单图描述组成。

## 共同描述

The three references are approved concept art for a miniature tabletop film set. Reference 1 establishes the colors and handmade material scale, reference 2 shows the hero toy for style only, reference 3 shows paper and paint. Produce ONE flat production texture, edge-to-edge. No toys, people, writing, signage, logos, visible borders, camera perspective, cast shadows, directional light or studio mockup.

## 受影墙面

Generate a wide 1800:1040 flat diffuse albedo map of the CREAM CARDSTOCK only from the housing-block facade. Imagine lifting off all windows, sills, columns, doors, glue tabs, corrugated trim, roof and props, leaving one single smooth rectangular sheet of light biscuit cream paper (#e6d2b3), revealed fibrous speckle, mostly uniform across the full sheet. It receives a projected shadow in game, so keep the overall paper bright and low contrast. Four thin, straight, lightly dry-brushed painted horizontal stripes run edge to edge; each is roughly 2 percent of image height, with a little natural uneven pigment, without height or bevel. From TOP to BOTTOM: muted coral (#d98a5f), muted sage (#7fb5a6), muted golden ochre (#e8b85a), muted coral. Stripe CENTRES at approximately 29.2%, 52.3%, 75.4%, and 98.5% of the full image height, with slightly more plain paper above the first stripe representing a parapet. Stripe guides are not visible. The fourth stripe fits near the very bottom. Nothing vertical breaks the paper. Absolutely zero openings, windows, panels, beams, divisions, sill lines, mortar or any illustration. Orthographic flatbed scan, no lighting gradient, no depth. Full bleed.

## 木桌面

Create a square periodic diffuse material scan for the warm honey-brown wooden tabletop in reference 1. Cover the entire square with continuous fine real wood grain, running strictly VERTICALLY from top edge to bottom edge, as a few wide adjacent pale honey-oak or worn beech boards in the same mellow value. Top-down artisan modelmaker's table, subtle rubbed warm amber tones and small variations in individual lines. The grain is gentle and the overall brightness stays even so a yellow duck and red lamp remain instantly visible over this material. Seamless texture for repeating horizontally and vertically five times in game. Opposite edges should match naturally, no break in grain at the top or bottom. Avoid large distinctive knots, dark seams, dents, highlights, tabletop corners, metal rim, rail tracks, nails, props, lettering, borders, gradient or vignette. Matte flat diffuse albedo, no baked lighting. All four edges filled with wood.

## 剪纸天幕

Make a wide 2:1 painted paper theatrical cyclorama background texture, entirely front-on. Layered cut-paper artwork on a deep teal hand-gouached paper with visible fine brush grain. Night-time sky at top deep blue-green (#0d2029), gently paling toward muted jade-teal at the horizon (#5b8d84). A single small warm cream paper moon sits off centre at roughly 30% from the left, 30% from top. Quiet open space over the top two thirds. Along the bottom third only build a few staggered layers of quiet angular cut-card city blocks, generic low and mid-rise Singapore neighbourhood silhouettes, mostly straight flat roofs, all windows simple tiny scattered warm paper rectangles. Foreground blocks deeper teal, distant blocks desaturated misty teal. Match the handmade flat theatrical backcloth of the concept. Important: only the scenic painting itself up to each image edge, like a scanned painted backdrop before mounting it, with no stage, frame, ground plane, prop, real landmark, skyline attraction, lettering, literal stage curtain or light beam. Design light enough to read behind the real game props without competing with the facade.

## 天幕机位修订

以天幕首稿和三张原始设定图为参考，让月亮出现在布景镜头能拍到的位置。

Make a targeted revision to image 1, the flat 2:1 painted theatre backdrop texture. Images 2–4 are the approved style references. Keep image 1's same full-bleed teal painted-paper style, crop, color gradient, layered city silhouettes in the bottom third and small warm windows. Change the location of its single moon: remove the original moon at upper left and restore uninterrupted teal painted sky there. Put ONE small pale cream paper moon low in the sky at exactly 66.5% of total width from the LEFT, and 68% of total height from the TOP; just above the rooftops in a small gap. Keep the complete circle visible and leave a little air around it, lowering nearby far-off rooftops locally if needed. Diameter should be approximately 2.1% of the texture width. This lower moon position is essential: the real game camera shows only a horizontal strip of a much larger scenic panel. The moon is a matte cut-paper disc, no halo or lighting effects. No other change, text, borders, gradients of directional light, scenery props or animals.

## 纹理导出

- 立面为 1800 × 1040。保留顶部 80 像素的纸面，四层楼各高 240 像素。从顶边计算，四色带的起始行依次为 276、516、756、996，各高 30 像素，与样板关已有色带的范围一致。
- 木桌面为 1024 × 1024。将原图缩为 1152 × 1152，在横纵两个方向分别对 128 像素的边缘做平滑重叠，导出一个完整重复周期，保留木纹方向。
- 天幕为 2048 × 1024。三张贴图都采用不透明、8 位 sRGB PNG，通过现有材质槽加载。
