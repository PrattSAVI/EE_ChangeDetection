//Display laos admin from shapefile
var laosadmin = geometry;

var imCol = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
    .filterDate('2021-06-01', '2021-09-30')
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .filterBounds(geometry).median(); //Convert the brightness temperature (Kelvin 0.1) to Celsius 

var tempC = imCol
    .select('B10')
    .multiply(0.1)
    .subtract(273.5)
    .clip(geometry);

Map.addLayer(tempC, { min: 0, max: 50, palette: ['lightgreen', 'yellow', 'red'] }, 'Collection'); //import image colllection

print(tempC)

// - Export

var projection = tempC.select('B10').projection().getInfo();
print(projection)

Export.image.toDrive({
    image: tempC,
    description: 'imageToCOGeoTiffExample',
    crs: projection.crs,
    crsTransform: projection.transform,
    region: geometry,
    fileFormat: 'GeoTIFF',
    formatOptions: {
        cloudOptimized: true
    }
});