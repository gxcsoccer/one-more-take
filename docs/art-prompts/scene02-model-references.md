# 第 02 场道具素材

聚光灯和黑猫使用多视图重建。其余六件道具通过平面与盒子贴图接入。下表链接到实际交付文件。[总览](previews/scene02-model-references.jpg)

| 道具 | 文件 | 用途 |
| --- | --- | --- |
| 聚光灯 | [正面](scene02-models/lamp-front.jpg) · [侧面](scene02-models/lamp-side.jpg) | 一对模型参考，1024 × 1024 |
| 黑猫 | [正面](scene02-models/cat-front.jpg) · [侧后方](scene02-models/cat-three-quarter.jpg) | 一对模型参考，1024 × 1024 |
| 短发居民 | [常态](../../public/assets/props/resident-1-idle.png) · [举手](../../public/assets/props/resident-1-raised.png) | 单个平面上的两个姿势 |
| 鸭舌帽居民 | [常态](../../public/assets/props/resident-2-idle.png) · [举手](../../public/assets/props/resident-2-raised.png) | 单个平面上的两个姿势 |
| 卷发居民 | [常态](../../public/assets/props/resident-3-idle.png) · [举手](../../public/assets/props/resident-3-raised.png) | 单个平面上的两个姿势 |
| 三层邻楼 | [正面](../../public/assets/props/block-a-front.webp) · [侧面](../../public/assets/props/block-a-side.webp) | 880 × 600 与 320 × 600 |
| 四层邻楼 | [正面](../../public/assets/props/block-b-front.webp) · [侧面](../../public/assets/props/block-b-side.webp) | 780 × 840 与 320 × 840 |
| 场记板 | [固定板面](../../public/assets/props/clapper-board.webp) | 768 × 576，动态文字的底图 |

## 贴图接入

- 居民的六张 PNG 都是 384 × 384。半身像的底边在第 364 行左右，水平中心在第 192 列。每次换姿势只切换同一平面的颜色贴图。受惊时沿用 `up` 的节奏与下沉运动；将旧手臂对象的动画改为换帧。使用 sRGB 和透明通道，在窗玻璃前检查剪纸边缘。
- 邻楼的 UV 原点和朝向沿用 Three.js 的盒子几何，各面使用完整的 0–1 区间。正面和侧面的每条色带已对齐到相同的相对高度。侧面可复用于两侧；屋顶、背面和底面可沿用纯色。
- 场记板贴图用于 `buildClapper().paint()` 的画布。每一拍先画底图，再画边框、文字与拍次。板面保持深色，使现有浅色字可读。活动打板臂和固定条纹条各有自己的几何体。
- 运行时素材合计约 1.2 MB。模型参考和总览仅供制作。完整的原始 PNG 在本机留存，仓库中的 JPEG 可直接作为 Meshy 输入。

## 贴图生成说明

居民使用每位人物原来的正面作为身份参考。生成一张左右双格的透明图，同一件剪纸、同一正面镜头，左格为常态，右格为双手举至耳侧，发型、眼睛、纸边、衣领与胸像底边对齐。导出时按衣身底边中心和共同的头顶高度对齐两帧，保留原生透明通道。

邻楼以原有正面与侧前方造型图为参考，生成单独的侧墙正投影视图。三层楼每层一扇小窗、灰绿色带，四层楼采用赭黄与珊瑚色交替。两侧颜色延续到墙边，正面从原图裁出建筑表面，侧面逐层对齐色带高度。

场记板以原参考图的木质旧边为依据，生成满幅 4∶3 深炭灰板面。中央留出均匀的书写区，边缘仅有轻微磨损。游戏在上面绘制文字和标线。

## 聚光灯的接入尺寸

车轮贴桌，镜片朝墙，镜片中心位于灯轨正上方。模型外廓目标为宽 7.5 cm、深 9 cm、高 8 cm，光轴离桌面 4 cm。从正面参考图按整灯高 8 cm 换算，镜片中心约为 3.9 cm。导入 GLB 后量轮底和镜片中心的世界坐标，沿轨道移动到两端复核。比例有误时先调整灯头与底盘的相对位置，保留圆形镜片。[美术规格与 Meshy 请求参数](../art-brief.md)

## 出图提示词

每张图都以已采纳的片场、发条鸭和纸板立面设定图作为材质参考。补充视角同时使用对应道具的正面，聚光灯按下列修订过程出图。[片场](../concept/tabletop-set.png) · [发条鸭](../concept/wind-up-duck.png) · [纸板立面](../concept/cardboard-facade.png)

### 原始道具正面的共用说明

An isolated handmade miniature prop for image-to-3D reconstruction, straight-on FRONT elevation, full object entirely visible and centered on a solid uniform light blue-gray background. Flat soft light, no floor plane or cast shadow, no labels, text, watermarks or props. Square frame. Three approved reference sheets establish one common world: the tabletop miniature in the first, painted enamel or wood in the second, layered warm paper material in the third. Output a SINGLE object only, never a contact sheet.

### clapper

A palm-size film clapperboard, 16 cm wide by 14 cm tall, seen perfectly front-on. Unlettered warm ivory rectangular painted wooden slate with a slender dark frame. Slim black-and-cream diagonal stripes on a separate gently opened top clapper arm and its mating fixed rail; one round antique brass pivot at the top left. The main board below is completely empty, for runtime lettering. Simple clean silhouette matching the clapper to the right of the tabletop concept. Show no support.

### cat

One seated matte charcoal-black articulated wooden puppet cat, about 8 cm tall, quiet mischievous expression. Front-facing, two pointed little ears, a pair of round amber yellow eyes, compact pear-shaped torso, two plausible tiny paws. A single tail of 5 dark wooden beads curves gently up one side. Very subtle wood grain and joint seams, readable silhouette. No whisker wires, collar, garments, platform or base.

### resident-1

One simple 5 cm tall flat die-cut cardboard window resident, a bust only (head, shoulders and chest ending at a straight horizontal bottom edge); dark desaturated ink, almost a silhouette. Distinct smooth round bob haircut on a friendly adult, face facing the viewer, simple tiny warm-gold dot eyes only, slight warm paper edge and sparse print grain, static arms formed with the torso. No backing card, stand, legs, or frame.

### resident-2

One simple 5 cm tall flat die-cut cardboard window resident, a bust only (head, shoulders and chest ending at a straight horizontal bottom edge); matte deep ink, almost a silhouette. Distinct low-brim workman's cap tilting slightly to one side on a friendly adult, face toward camera, simple tiny warm-gold dot eyes only, slight warm paper edge and sparse print grain, static arms formed with the torso. No backing card, stand, legs, or frame.

### resident-3

One simple 5 cm tall flat die-cut cardboard window resident, a bust only (head, shoulders and chest ending at a straight horizontal bottom edge); matte dark ink, almost a silhouette. Distinct big loose scalloped curls, friendly adult facing camera, two simple tiny warm-gold dot eyes, slight warm paper edge, static arms formed with torso. No backing card, stand, legs, or frame.

### block-a

One short, wide flat-roofed rectangular miniature cardboard apartment building, a simple three-storey Singapore neighbourhood block, 30 cm tall, around 44 cm wide, 16 cm deep. Flat cream paper facade, three modest rows of four inset dark teal cut-paper windows with a few muted buttery yellow window inserts; faded sage-green thin floor bands, a narrow flat overhanging kraft cap. Exposed corrugated paper edges. A plainer, less prominent neighbour of the hero facade. Orthographic FRONT, verticals level; no door signs, railings, antennas, landscaping or adjoining buildings.

### block-b

One modest tall narrow four-storey miniature cardboard apartment block, approximately 42 cm tall, 39 cm wide, 16 cm deep. Cream uncoated kraft board, a thin flat roof, four neat rows of three inset rectangular teal glazed-paper windows with just a few pale yellow inserts. Horizontal faded ochre and muted coral paper bands and exposed fluted edges. Handmade Singapore neighbourhood architecture, distinctly taller than the short neighbour. Orthographic FRONT elevation, no writing, penthouse, balconies protruding far, plants or base.

## 聚光灯迭代

### 聚光灯造型初稿

Single clean, centered, full-object orthographic front elevation for image-to-3D reconstruction. Make ONE miniature 1930s-style movie set spotlight on a squat four-wheel dolly, seen directly into its circular glass lens. The 3 attached approved concept sheets set the prop design language: image 1 contains the matching red lamp and the two other sheets establish enamel/brass and handmade craft. Keep proportions engineered for a very LOW optical axis: the round lens center is exactly halfway between the lowest wheel contact and the highest point of the object; use a low cylinder and a modest fixed folded brass carrying handle above the cylinder to balance the silhouette if necessary. About 8 cm total height, 7.5 cm across including pivots, 9 cm deep. Horizontal red enamel barrel, one substantial circular brass bezel around a pale buttery unlit Fresnel lens, brass U-yoke grasping the sides, two tiny side pivots, just four small flanged wheels on a red rectangular dolly. No rails. Match the tabletop hand-painted enamel model aesthetic, a few brass rivets. Make the design simple enough to reconstruct. Face-on straight, camera at the height of the lens; level, absolutely no tilt or perspective. One object occupying 75% frame on a perfectly plain light blue-grey background, flat diffuse fill, no ground, shadows, glow, cables, light rays, captions, diagrams, grids, other props or typography. Square image.

### 压低底盘

Edit the object in image 1, using it as a material sample, and redesign its proportions as a low-slung, broad, front-facing real miniature rail spotlight. The old body floats too high. MAIN MECHANICAL CHANGE: mount the barrel almost directly on a thin flat red trolley between the wheels, with no pedestal or riser underneath the U-yoke. Put the small axle wheels substantially OUTSIDE the chassis so their tops sit level with the bottom of the lens. Short, wide brackets bolt to the sides at axle level. Keep the horizontal cylinder, its concentric Fresnel lens, four brass bezel rivets, enamel red, and single brass carry handle across the top. Huge importance: the gold circular lens centre should coincide precisely with the centre of the entire square image. Use this frontal orthographic bounding geometry in a square composition: wheel contact y=85% from top, top of handle y=15%, lens optical centre (50%,50%), wheel-to-wheel width spans x=17% to 83%, outer lens rim 43% of image width. The over-the-top brass carry handle can be raised to attain this; the region below the lens midpoint must be compact. The dolly deck is a single thin horizontal piece. Rear wheels hidden by front pair. No rails. All object parts centered horizontally. Orthographic straight-on, virtually no top plane visible. One prop, same blue-grey flat background, even diffuse illumination, no ground, cast shadow, labels or measurements.

### 修订前视把手

Precision revision of the front elevation in image 1, same miniature light, same four rivets, same low dolly and same wheel hardware and blue background. Keep the lens, barrel, dolly, wheels and their locations entirely unchanged. Shorten ONLY the tall brass carrying handle: lower the top bar of the handle by half its present clear gap above the barrel, shortening the two vertical legs cleanly and keeping hardware points on the red barrel in place. This is a modest geometry calibration: total object height decreases just enough that the middle of the circular lens lies halfway from the highest edge of the handle down to the lowest wheel contact. Keep the original framing, camera orthographic front, lighting flat with no floor, shadow, rays, captions or dimension lines. All attached secondary references are only material context.

### 聚光灯侧视初稿

Make the strict right-hand SIDE elevation of the exact single miniature spotlight and trolley shown in reference image 1. It is the second view for an image-to-3D reconstruction, so keep the same circular front with four cardinal rivets, red enamel barrel and one large raised rectangular brass handle mounted ACROSS the barrel as seen from the front, a thin red dolly plate and four chunky flanged brass wheels. The front lens is on the LEFT in this side view, viewed edge-on as a narrow brass rim: the lens plane is vertical and optical axis horizontal. A plain rounded red back cap is on the right. Two near-side wheels are seen fully circular; the far wheels line up behind them. Object is very low, short brackets connect barrel directly to dolly. Place the lens axis exactly halfway up the full 8 cm silhouette. Length wheel-to-wheel plus end projections about 9 cm. This is a true flat side orthographic view, no three-quarter rotations or dramatic perspective. Match image 1's finish and muted blue-grey background, diffuse flat lighting. The other reference images establish the miniature film-set style. Leave ample margins on all sides, focus. No contact shadow, track, dimension marks or lettering. No new details or duplicated handles.

### 修订侧视把手

Orthographic side elevation correction. Image 1 is the side-view edit target. Image 2 is the definitive FRONT photo of this exact spotlight, keep its design. From the front there is ONE U-shaped brass handle running across the barrel, left-to-right, across the diameter. Therefore in this strict side view the brass U is edge-on: show just a single narrow brass upright seen end-on with a rounded gold cap and narrow mounting flange directly above the barrel MIDPOINT. It should be about one thumb wide. There must be NO long horizontal bridge, no two separated legs visible and no arch-shaped blue opening above the barrel. It is not a front-to-back suitcase handle. Reduce the handle projection above the red barrel to match image 2; preserve the wheel contact, optical axis at mid-height, left-facing vertical lens rim, red chassis, red barrel, brass wheels and two short mount brackets of image 1. Let the barrel diameter match the broad front housing, roughly two thirds to three quarters of total prop height. One full isolated miniature, same scale, flat diffuse illumination and unbroken plain blue-grey background with comfortable margins on all sides, square image no lines or text.

### 收窄前轮距

Make a precision mechanical correction to just the lower dolly in the provided straight-on front image of a miniature studio light. The current OUTRIGGER wheelbase is much too wide. Preserve the barrel, Fresnel lens and brass bezel, including its exact circular size, full silhouette height, original camera and the low top handle. Tuck both brass wheels much closer in, partially behind the lens housing. Each wheel centre should line up with the extreme left or extreme right edge of the round red barrel. Shorten the chassis and axle accordingly. The two outer axle caps should project only slightly past each side of the red barrel. The dolly should look narrow and compact, NOT flared outward. Match these physical dimensions: overall prop from contact to handle 8 cm; total outer axle width 7.5 cm; exterior barrel diameter about 6.3 cm. Wheel contact plane stays in its original place. The lens centre is 4 cm above it, halfway up the prop. Absolutely do not compress or distort the round lens. Keep everything else from the reference front. It is still ONE static four-wheel red enamel spotlight on flat pale-blue background, without shadows, words, ground or rails. Center and photograph orthographically from directly in front, with comfortable margin.

### 前视轮距定稿

Same-size matched photos of the same enamel toy spotlight; image 1 has wheel spacing too narrow, image 2 has it too wide. Produce one final orthographic FRONT design whose wheel positions are exactly halfway between those two versions. Use image 1 as the edit target and image 2 only for position interpolation. Keep lens, red barrel, carrying handle, hardware and wheel diameter/height fixed. Move each wheel horizontally OUT from its location in image 1 by about two-thirds of the width of that wheel. Extend the red chassis and each brass axle to meet the new wheel location. Lens stays circular and centered. Final axle width differs from total handle-to-wheel height by only about six percent: 7.5 units wide, 8 tall. Lens center exactly 4 units above the wheel contact line. Keep a balanced narrow blue gap between front lens bezel and wheels instead of large outriggers. Background uniform and diffuse, no shadows or text. One object only in the same centered front framing.

## 补充视角提示词

### cat

Turn the exact same handmade seated black wooden puppet cat in reference 1 to show its right three-quarter rear view from almost eye level. Preserve the original big round head, pointed ears, seated compact posture, two jointed paws with brass pins, and exactly one curved tail consisting of five graduated wooden beads attached at the rump. Preserve the amber eyes, charcoal matte finish and subtle grain. One cat only, entire object centered against the same uniform blue-gray background, soft flat light, no floor or shadow. Used together with reference 1 for 3D reconstruction; prioritize identity, part count and proportions. Other references are only material context.

### block-a

Turn the exact same handmade cardboard building from reference 1 by approximately 32 degrees to show the original front and its right wall. Keep the same height, front windows, number of floors, band colors, flat roof and materials, including the particular roof cap silhouette. This is a shallow three-dimensional box, about 16 cm deep relative to its 44 cm front width and 30 cm height. Wrap the same colored floor bands around the right side with up to two simple mostly dark small windows per floor. One isolated miniature, full building in view, almost orthographic, level camera with only a little of the roof visible. Same flat plain blue-grey background and diffuse light as the front reference. No ground plane, stand, cast shadows, lettering, doors with writing or other objects. The other concept sheets establish the materials.

### block-b

Turn the exact same handmade cardboard building from reference 1 by approximately 32 degrees to show the original front and its right wall. Keep the same height, front windows, number of floors, band colors, flat roof and materials, including the particular roof cap silhouette. This is a shallow three-dimensional box, about 16 cm deep relative to its 39 cm front width and 42 cm height. Wrap the same colored floor bands around the right side with up to two simple mostly dark small windows per floor. One isolated miniature, full building in view, almost orthographic, level camera with only a little of the roof visible. Same flat plain blue-grey background and diffuse light as the front reference. No ground plane, stand, cast shadows, lettering, doors with writing or other objects. The other concept sheets establish the materials.

## 聚光灯模型的生成记录

2026-11-28 用 Meshy 的 `POST /openapi/v1/multi-image-to-3d` 生成，输入为上面的正面和侧面两张参考图（正面在前），参数：`ai_model` meshy-7.1，`geometry_resolution` standard，`texture_model` meshy-7，`should_remesh` true，`topology` triangle，`target_polycount` 6000，`should_texture` true，`enable_pbr` true，`texture_resolution` 2k，`target_formats` ["glb"]。

- 实际扣费 30 点，直接从套餐的月度积分里扣，没有单独的 API 额度。
- 产出 6063 个三角面，一个网格，三张 2K 贴图（颜色、金属度与粗糙度、法线），原文件 10.3 MB。
- 入库前用 `node scripts/shrink-glb.mjs` 把贴图缩到 1024 并转成 JPEG，得到 [`public/assets/models/lamp.glb`](../../public/assets/models/lamp.glb)，1.3 MB。
- 接入时由代码自动找出镜片所在的一端并转向墙面，车轮落在 0.35 cm 高的轨顶上，再按“镜片中心离桌面 4 cm”缩放。缩放后整灯高 7.6 cm、宽 5.0 cm、长 7.8 cm。轨道按这盏灯的轮距重新铺设。
- Meshy 返回的预览图：[lamp-model.png](previews/lamp-model.png)。
