// let's think our stage virtual size will be 1000x1000px
// but the real size will be different to fit user's page
// so the stage will be 100% visible on any device
/* 스테이지 설정 */
var stageWidth = 1000;
var stageHeight = 1000;

var stage = new Konva.Stage({
  container: 'container',
  width: stageWidth,
  height: stageHeight,
  draggable: true
});

/* 레이어 설정 */
var layer = new Konva.Layer();
stage.add(layer);

var layerStory = new Konva.Layer();
stage.add(layerStory);

var layerUser = new Konva.Layer();
stage.add(layerUser);

/* 윈도우 사이즈에 맞게 컨테이너 조정 */
function fitStageIntoParentContainer() {
  var container = document.querySelector('#stage-parent');

  // now we need to fit stage into parent
  var containerWidth = container.offsetWidth;
  // to do this we need to scale the stage
  var scale = containerWidth / stageWidth;

  stage.width(stageWidth * scale);
  stage.height(stageHeight * scale);
  stage.scale({ x: scale, y: scale });
  stage.draw();
}

// adapt the stage on any window resize
window.addEventListener('resize', fitStageIntoParentContainer);

// for cache
var el, newPoint, newPlace, offset;

/* 컨테이너에 줌인/아웃 기능 추가 */
var scaleBy = 1.01;
stage.on('wheel', function(e) {
  e.evt.preventDefault();
  var oldScale = stage.scaleX();
  if (oldScale > 2) {
    stage.scale({ x: 2, y: 2 });
    return;
  } else if (oldScale < 0.1) {
    stage.scale({ x: 0.1, y: 0.1 });
    return;
  }

  var mousePointTo = {
    x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
    y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale
  };

  var newScale = e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;
  stage.scale({ x: newScale, y: newScale });
  $('#canvasScaler').val(newScale);

  var newPos = {
    x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
    y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale
  };
  stage.position(newPos);
  stage.batchDraw();
});

function test() {
  Konva.Image.fromURL('/dokdo.svg', function(image) {
    image.setAttrs({
      width: 100,
      height: 50,
      x: 850,
      y: 300
    });
    console.log(image);
    layer.add(image);
  });
}

/* 줌인/아웃 scaler 설정 */
function scalerInit() {
  $('#canvasScaler').val(stage.scaleX());
  $('#canvasScaler')
    .on('input', function() {
      var scaleValue = $('#canvasScaler').val();

      var oldScale = stage.scaleX();
      var mousePointTo = {
        x: stage.width() / 2 / oldScale - stage.x() / oldScale,
        y: stage.height() / 2 / oldScale - stage.y() / oldScale
      };
      stage.scale({ x: scaleValue, y: scaleValue });

      var newPos = {
        x: -(mousePointTo.x - stage.width() / 2 / scaleValue) * scaleValue,
        y: -(mousePointTo.y - stage.height() / 2 / scaleValue) * scaleValue
      };
      stage.position(newPos);
      stage.batchDraw();

      // Cache this for efficiency
      el = $(this);

      // Measure width of range input
      width = el.width();

      // Figure out placement percentage between left and right of input
      newPoint =
        (el.val() - el.attr('min')) / (el.attr('max') - el.attr('min'));
      console.log(newPoint);
      // Janky value to get pointer to line up better
      offset = -1.7;

      // Prevent bubble from going beyond left or right (unsupported browsers)
      if (newPoint < 0) {
        newPlace = 0;
      } else if (newPoint > 1) {
        newPlace = width;
      } else {
        newPlace = width * newPoint + offset;
        offset -= newPoint;
      }
      var container = document.querySelector('#stage-parent');
      var scale = container.offsetWidth / stageWidth;
      console.log(scale);

      // Move bubble
      el.next('output')
        .css({
          left: newPlace,
          marginLeft: offset + '%'
        })
        .text('x' + Math.round((el.val() / scale) * 10) / 10);
    })
    .trigger('input');

  $('#canvasScaler').mouseover(function() {
    el = $(this);

    el.next('output').css({
      display: 'inline-block'
    });
  });
  $('#canvasScaler').mouseleave(function() {
    el = $(this);

    el.next('output').css({
      display: 'none'
    });
  });

  $('#canvasScaler')
    .next('output')
    .css({
      display: 'none'
    });
}
