import pointInSvgPolygon from "point-in-svg-polygon";

addEventListener("message", (message) => {
	const rawData = new Array();
	let tpPoints = new Array();
	const minYTopCp = message.data.minYTopCp;
	const maxYBottomCp = message.data.maxYBottomCp;
	const minXLeftCp = message.data.minXLeftCp;
	const maxXRightCp = message.data.maxXRightCp;
	const segments = pointInSvgPolygon.segments(message.data.path);
  for (let y = minYTopCp; y < maxYBottomCp; y++) {
		for (let x = minXLeftCp; x < maxXRightCp; x++) {
			if (!pointInSvgPolygon.isInside([x, y], segments)) {
				if (pointInSvgPolygon.isInside([x - 1, y], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
				if (pointInSvgPolygon.isInside([x + 1, y], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
				if (pointInSvgPolygon.isInside([x, y - 1], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
				if (pointInSvgPolygon.isInside([x, y + 1], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
			}
		}
	}

	let minXLeftTp = Math.min(...(tpPoints.flatMap(tp => { return tp.x; })));
  let maxXRightTp = Math.max(...(tpPoints.flatMap(tp => { return tp.x; })));
  let minYTopTp = Math.min(...(tpPoints.flatMap(tp => { return tp.y; })));
  let maxYBottomTp = Math.max(...(tpPoints.flatMap(tp => { return tp.y; })));

  for (let y = minYTopTp; y < maxYBottomTp; y++) {
    for (let x = minXLeftTp; x < maxXRightTp; x++) {
      if (pointInSvgPolygon.isInside([x, y], segments)) { // selected area
        rawData.push({"x": x, "y": y, "inside": true });
      } else { // transparent points to make ImageData a rect
        rawData.push({"x": x, "y": y, "inside": false });
      }
    }
  }
	
	const width = maxXRightTp - minXLeftTp;
  const height = maxYBottomTp - minYTopTp;
	postMessage({ "rawData": rawData, "width": width, "height": height });
});