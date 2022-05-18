//===========================================================================================
//             BURN SEVERITY MAPPING USING THE NORMALIZED BURN RATIO (NBR)
//===========================================================================================

//Yangin Oncesi - Yangin 2021 yilinda oldu
var prefire_start = '2019-12-20';
var prefire_end = '2020-12-18';


// Yangin Sonrasi
var postfire_start = '2021-07-20';
var postfire_end = '2021-09-28';

var platform = 'L8';

//---------------------------------- Translating User Inputs --------------------------------

// Print Satellite platform and dates to console
if (platform == 'S2' | platform == 's2') {
    var ImCol = 'COPERNICUS/S2';
    var pl = 'Sentinel-2';
} else {
    var ImCol = 'LANDSAT/LC08/C01/T1_SR';
    var pl = 'Landsat 8';
}
print(ee.String('Data selected for analysis: ').cat(pl));
print(ee.String('Fire incident occurred between ').cat(prefire_end).cat(' and ').cat(postfire_start));

// Location
var area = ee.FeatureCollection(geometry);

// Set study area as map center.
Map.centerObject(area);

//----------------------- Select Landsat imagery by time and location -----------------------

var imagery = ee.ImageCollection(ImCol);
var clouds = 4
    // In the following lines imagery will be collected in an ImageCollection, depending on the
    // location of our study area, a given time frame and the ratio of cloud cover.
var prefireImCol = ee.ImageCollection(imagery
    .filterDate(prefire_start, prefire_end)
    .filterBounds(area)
    .filter(ee.Filter.lt('CLOUD_COVER', clouds)));

// Select all images that overlap with the study area from a given time frame 
// As a post-fire state we select the 25th of February 2017
var postfireImCol = ee.ImageCollection(imagery
    .filterDate(postfire_start, postfire_end)
    .filterBounds(area)
    .filter(ee.Filter.lt('CLOUD_COVER', clouds)));

// Add the clipped images to the console on the right
print("Pre-fire Image Collection: ", prefireImCol);
print("Post-fire Image Collection: ", postfireImCol);

var pre_cm_mos = prefireImCol.median().clip(area);
var post_cm_mos = postfireImCol.median().clip(area);

print("pre-mosaic", pre_cm_mos);

//------------------ Calculate NBR for pre- and post-fire images ---------------------------

// Apply platform-specific NBR = (NIR-SWIR2) / (NIR+SWIR2)
if (platform == 'S2' | platform == 's2') {
    var preNBR = pre_cm_mos.normalizedDifference(['B8', 'B12']);
    var postNBR = post_cm_mos.normalizedDifference(['B8', 'B12']);
} else {
    var preNBR = pre_cm_mos.normalizedDifference(['B5', 'B7']);
    var postNBR = post_cm_mos.normalizedDifference(['B5', 'B7']);
}

//------------------ Calculate difference between pre- and post-fire images ----------------

// The result is called delta NBR or dNBR
var dNBR_unscaled = preNBR.subtract(postNBR);

// Scale product to USGS standards
var dNBR = dNBR_unscaled.multiply(1000);

// Add the difference image to the console on the right
print("Difference Normalized Burn Ratio: ", dNBR);

//==========================================================================================
//                                    ADD LAYERS TO MAP

//---------------------------------- True Color Imagery ------------------------------------
// Apply platform-specific visualization parameters for true color images
if (platform == 'S2' | platform == 's2') {
    var vis = { bands: ['B4', 'B3', 'B2'], max: 2000, gamma: 1.5 };
} else {
    var vis = { bands: ['B4', 'B3', 'B2'], min: 0, max: 4000, gamma: 1.5 };
}

// Add the true color images to the map.
Map.addLayer(pre_cm_mos, vis, 'Pre-fire True Color Image');
Map.addLayer(post_cm_mos, vis, 'Post-fire True Color Image');

//-------------------------- Mask Water Areas -----------------------------
// Resolution is 30m water the JRC water max-extent
var water = ee.Image("JRC/GSW1_3/GlobalSurfaceWater");
water = water.select('max_extent');
dNBR = dNBR.updateMask(water.not());

//------------------------- Burn Ratio Product - Classification ----------------------------

// Define an SLD style of discrete intervals to apply to the image.
var sld_intervals =
    '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false" >' +
    '<ColorMapEntry color="#ffffff" quantity="-500" label="-500"/>' +
    '<ColorMapEntry color="#7a8737" quantity="-250" label="-250" />' +
    '<ColorMapEntry color="#acbe4d" quantity="-100" label="-100" />' +
    '<ColorMapEntry color="#0ae042" quantity="100" label="100" />' +
    '<ColorMapEntry color="#fff70b" quantity="270" label="270" />' +
    '<ColorMapEntry color="#ffaf38" quantity="440" label="440" />' +
    '<ColorMapEntry color="#ff641b" quantity="660" label="660" />' +
    '<ColorMapEntry color="#a41fd6" quantity="2000" label="2000" />' +
    '</ColorMap>' +
    '</RasterSymbolizer>';

// Add the image to the map using both the color ramp and interval schemes.
Map.addLayer(dNBR, { min: -1000, max: 1000, palette: 'white,black' }, 'dNBR greyscale');
Map.addLayer(dNBR.sldStyle(sld_intervals), {}, 'dNBR classified');

// Seperate result into 8 burn severity classes
var thresholds = ee.Image([-1000, -251, -101, 99, 269, 439, 659, 2000]);
var classified = dNBR.lt(thresholds).reduce('sum').toInt();

//==========================================================================================
//                                    ADD A LEGEND

// set position of panel
var legend = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '8px 15px'
    }
});

// Create legend title
var legendTitle = ui.Label({
    value: 'dNBR Classes',
    style: {
        fontWeight: 'bold',
        fontSize: '18px',
        margin: '0 0 4px 0',
        padding: '0'
    }
});

// Add the title to the panel
legend.add(legendTitle);

// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {

    // Create the label that is actually the colored box.
    var colorBox = ui.Label({
        style: {
            backgroundColor: '#' + color,
            // Use padding to give the box height and width.
            padding: '8px',
            margin: '0 0 4px 0'
        }
    });

    // Create the label filled with the description text.
    var description = ui.Label({
        value: name,
        style: { margin: '0 0 4px 6px' }
    });

    // return the panel
    return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
    })
};

//  Palette with the colors
var palette = ['7a8737', 'acbe4d', '0ae042', 'fff70b', 'ffaf38', 'ff641b', 'a41fd6', 'ffffff'];

// name of the legend
var names = ['Enhanced Regrowth, High', 'Enhanced Regrowth, Low', 'Unburned', 'Low Severity',
    'Moderate-low Severity', 'Moderate-high Severity', 'High Severity', 'NA'
];

// Add color and and names
for (var i = 0; i < 8; i++) {
    legend.add(makeRow(palette[i], names[i]));
}

// add legend to map (alternatively you can also print the legend to the console)
Map.add(legend);