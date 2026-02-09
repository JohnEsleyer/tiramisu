export function getFitScale({
  screenWidth,
  screenHeight,
  sourceWidth,
  sourceHeight,
  fit
}) {
  if (!screenWidth || !screenHeight || !sourceWidth || !sourceHeight) {
    return { x: 1, y: 1 };
  }

  const screenAspect = screenWidth / screenHeight;
  const sourceAspect = sourceWidth / sourceHeight;

  if (Math.abs(screenAspect - sourceAspect) < 0.0001) {
    return { x: 1, y: 1 };
  }

  if (fit === 'cover') {
    if (screenAspect > sourceAspect) {
      return { x: 1, y: screenAspect / sourceAspect };
    }
    return { x: sourceAspect / screenAspect, y: 1 };
  }

  if (screenAspect > sourceAspect) {
    return { x: sourceAspect / screenAspect, y: 1 };
  }
  return { x: 1, y: screenAspect / sourceAspect };
}

export function computeClipTransform({ clip, screen, sourceWidth, sourceHeight }) {
  const baseScale = Number(clip?.scale ?? 1) || 1;
  const fitScale = getFitScale({
    screenWidth: screen?.width,
    screenHeight: screen?.height,
    sourceWidth,
    sourceHeight,
    fit: screen?.fit === 'cover' ? 'cover' : 'contain'
  });

  return {
    scaleX: baseScale * fitScale.x,
    scaleY: baseScale * fitScale.y,
    translateX: Number(clip?.x ?? 0.5) || 0.5,
    translateY: Number(clip?.y ?? 0.5) || 0.5,
    rotate: Number(clip?.rot ?? 0) || 0
  };
}

export function computeCanvasDrawRect({ clip, screen, sourceWidth, sourceHeight }) {
  const transform = computeClipTransform({ clip, screen, sourceWidth, sourceHeight });
  const drawWidth = (screen?.width || 0) * transform.scaleX;
  const drawHeight = (screen?.height || 0) * transform.scaleY;

  return {
    centerX: transform.translateX * (screen?.width || 0),
    centerY: transform.translateY * (screen?.height || 0),
    drawWidth,
    drawHeight,
    rotate: transform.rotate,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY
  };
}

export function normalizeScreen(screen, fallback) {
  const width = Number(screen?.width || fallback?.width || 0) || 0;
  const height = Number(screen?.height || fallback?.height || 0) || 0;
  return {
    width,
    height,
    fit: screen?.fit === 'cover' ? 'cover' : 'contain'
  };
}
