// Kakao Init
Kakao.init('7600a0cf289a958df5021746c9222d59');

// Amazon Cognito 인증 공급자를 초기화합니다
AWS.config.region = 'ap-northeast-2'; // 리전
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: 'ap-northeast-2:181ba321-7a7e-486d-9f43-3ac178405757',
  RoleArn:
    'arn:aws:iam::383760702031:role/Cognito_photoMapAdminCognitoUnauth_Role'
});

// AWS 자원을 가져온다
var ddb = new AWS.DynamoDB();
var athena = new AWS.Athena();
var date = new Date();

// Athena의 쿼리옵션
function partition(year, month, day) {
  if (day) {
    return 'year=' + year + ' and month=' + month + ' and day=' + day;
  } else if (month) {
    return 'year=' + year + ' and month=' + month;
  } else if (year) {
    return 'year=' + year;
  } else {
    return (
      'year=' +
      date.getUTCFullYear().toString() +
      ' and month=' +
      (date.getUTCMonth() + 1).toString() +
      ' and day=' +
      date.getUTCDate().toString()
    );
  }
}

var tableName = 'prod-photoMapTable';
var me;
var users = [];

function createLoginButton() {
  // 카카오 로그인 버튼을 생성합니다.
  Kakao.Auth.createLoginButton({
    container: '#kakao-login-btn',
    success: function(authObj) {
      console.log('Login success', JSON.stringify(authObj));
      // 로그인 성공시, API를 호출합니다.
      Kakao.API.request({
        url: '/v2/user/me',
        success: function(res) {
          if (res.properties.admin == 'true') {
            window.location.replace('/admin/index.html');
          } else {
            alert('관리자페이지에 접근할 권한이 없습니다.');
          }
          console.log('user info success', JSON.stringify(res));
        },
        fail: function(error) {
          alert('로그인이 실패했습니다.');
          console.log('user info error', JSON.stringify(error));
        }
      });
    },
    fail: function(err) {
      alert('로그인이 실패했습니다.');
      console.log('Login error', JSON.stringify(err));
    }
  });
}

// 로그인 확인
$(function() {
  Kakao.Auth.getStatusInfo(function(statusObj) {
    console.log(statusObj);
    if (statusObj.status == 'connected') {
      if (statusObj.user.properties.admin != 'true') {
        alert('관리자페이지에 접근할 권한이 없습니다.');
        Kakao.Auth.logout();
        window.location.replace('/admin/login.html');
      } else {
        // 로그인 성공
        console.log('success Login');
        me = statusObj.user;
        $('#userDropdown > span').text(me.kakao_account.profile.nickname);
        $('#userDropdown > img').attr(
          'src',
          me.kakao_account.profile.thumbnail_image_url
        );
      }
    } else {
      alert('로그인이 필요합니다.');
      Kakao.Auth.logout();
      window.location.replace('/admin/login.html');
    }
  });
});

/* 공용 */
// Athena 쿼리 가져오기
/*
  cardNumber, setCardNumber
  userChart, setUserChart
*/
function getQuery(queryName, callback) {
  console.log(queryName + '() called');

  if (queryName === 'cardNumber') {
    $('#standard').text(date.toLocaleDateString());
  }

  var params = {
    TableName: 'queryTable',
    ExpressionAttributeValues: {
      ':name': { S: queryName }
    },
    KeyConditionExpression: 'queryName = :name'
  };

  ddb.query(params, function(err, data) {
    if (err) {
      console.log('Error', err);
    } else {
      console.log(data.Items[0].id.S);
      getStatus(data.Items[0].id.S, callback);
    }
  });
}

// Row에서 값을 뽑아낸다.
function get(row, idx, type) {
  if (type) {
    return row.Data[idx][type];
  } else if (idx) {
    return row.Data[idx].VarCharValue;
  } else {
    return row.Data[0].VarCharValue;
  }
}

// query의 상태를 보고 Success일떄까지 대기한다.
function getStatus(id, callback) {
  console.log('getStatus() called');

  var params = {
    QueryExecutionId: id
  };

  athena.getQueryExecution(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log(data);
      var state = data.QueryExecution.Status.State;
      console.log(state);

      switch (state) {
        case 'QUEUED':
        case 'RUNNING':
          setTimeout(getStatus, 1000, id, callback);
          break;
        case 'SUCCEEDED':
          getResult(id, callback);
          break;
        default:
          break;
      }
    }
  });
}

// query의 결과를 가져온다.
function getResult(id, callback) {
  console.log('getResult() called');

  var params = {
    QueryExecutionId: id
  };

  athena.getQueryResults(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log(data);
      console.log(data.ResultSet.Rows);

      if (callback) {
        console.log('callback called');
        callback(data);
      }
    }
  });
}

// 로그아웃
function logout() {
  Kakao.Auth.logout();
  window.location.replace('/admin/login.html');
}

function uuid4() {
  // UUID v4 generator in JavaScript (RFC4122 compliant)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 3) | 8;
    return v.toString(16);
  });
}

function uuid() {
  var tokens = uuid4().split('-');
  return tokens[2] + tokens[1] + tokens[0] + tokens[3] + tokens[4];
}

/* index.html */
// 콜백: cardNumber 설정
function setCardNumber(data) {
  var rows = data.ResultSet.Rows;

  for (var i = 1; i < rows.length; i++) {
    $('#' + get(rows[i], 0) + 'Number').text(get(rows[i], 1));
  }
}

// 콜백: userChart 설정
function setUserChart(data) {
  var rows = data.ResultSet.Rows;
  var ctx = document.getElementById('UserChart');

  var myLabel = [];
  var myData = [];
  for (var i = 1; i < rows.length; i++) {
    myLabel.push(
      get(rows[i], 1) + '.' + get(rows[i], 2) + '.' + get(rows[i], 3)
    );
    myData.push(Number(get(rows[i], 0)));
  }

  var myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: myLabel,
      datasets: [
        {
          label: '유저수',
          lineTension: 0.3,
          backgroundColor: 'rgba(78, 115, 223, 0.05)',
          borderColor: 'rgba(78, 115, 223, 1)',
          pointRadius: 3,
          pointBackgroundColor: 'rgba(78, 115, 223, 1)',
          pointBorderColor: 'rgba(78, 115, 223, 1)',
          pointHoverRadius: 3,
          pointHoverBackgroundColor: 'rgba(78, 115, 223, 1)',
          pointHoverBorderColor: 'rgba(78, 115, 223, 1)',
          pointHitRadius: 10,
          pointBorderWidth: 2,
          data: myData
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 10,
          right: 25,
          top: 25,
          bottom: 0
        }
      },
      scales: {
        xAxes: [
          {
            time: {
              unit: 'date'
            },
            gridLines: {
              display: false,
              drawBorder: false
            },
            ticks: {
              maxTicksLimit: 7
            }
          }
        ],
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
              maxTicksLimit: 10,
              padding: 10
            },
            gridLines: {
              color: 'rgb(234, 236, 244)',
              zeroLineColor: 'rgb(234, 236, 244)',
              drawBorder: false,
              borderDash: [2],
              zeroLineBorderDash: [2]
            }
          }
        ]
      },
      legend: {
        display: false
      },
      tooltips: {
        backgroundColor: 'rgb(255,255,255)',
        bodyFontColor: '#858796',
        titleMarginBottom: 10,
        titleFontColor: '#6e707e',
        titleFontSize: 14,
        borderColor: '#dddfeb',
        borderWidth: 1,
        xPadding: 15,
        yPadding: 15,
        displayColors: false,
        intersect: false,
        mode: 'index',
        caretPadding: 10,
        callbacks: {
          label: function(tooltipItem, chart) {
            var datasetLabel =
              chart.datasets[tooltipItem.datasetIndex].label || '';
            return datasetLabel + ': ' + tooltipItem.yLabel;
          }
        }
      }
    }
  });
}

/* table-*.html */
function setDataTable(data) {
  console.log('setDataTable() called');

  var rows = data.ResultSet.Rows;
  console.log(rows);

  var cols = rows[0].Data.length;
  console.log(cols);

  var title = '';
  var columns = [];
  for (var i = 0; i < cols - 3; i++) {
    columns.push({ data: 'Data.' + i + '.VarCharValue' });
    title += '<th>' + get(rows[0], i) + '</th>';
  }
  console.log(columns);

  $('#dataTable').append(
    '<thead>\
    <tr>\
    ' +
      title +
      '\
    </tr>\
  </thead>\
  <tfoot>\
    <tr>\
    ' +
      title +
      '\
    </tr>\
  </tfoot>'
  );

  rows.splice(0, 1);

  var table = $('#dataTable')
    .DataTable({
      data: rows,
      columns: columns
    })
    .order([cols - 5, 'desc'])
    .draw();

  console.log(table);
}

/* notice.html */
// 공지사항 가져오기
function getNotice() {
  console.log('getNotice() called');

  var params = {
    TableName: 'noticeTable'
  };

  ddb.scan(params, function(err, data) {
    if (err) {
      console.log('Error', err);
    } else {
      console.log(data.Items);
      var table = $('#noticeTable')
        .DataTable({
          data: data.Items,
          columns: [
            { data: 'id.S' },
            { data: 'title.S' },
            { data: 'context.S' },
            { data: 'createdAt.N' },
            { data: 'updatedAt.N' },
            { data: null }
          ],
          columnDefs: [
            {
              targets: -1,
              data: null,
              defaultContent: '<button class="text-danger">X</button>'
            }
          ]
        })
        .order([3, 'desc'])
        .draw();

      $('#noticeTable tbody').on('click', 'button', function() {
        var row = table.row($(this).parents('tr'));
        var id = row.data().id.S;

        var params = {
          TableName: 'noticeTable',
          Key: {
            id: {
              S: id
            }
          }
        };

        ddb.deleteItem(params, function(err, data) {
          if (err) {
            console.log('Error', err);
          } else {
            row.remove();
            row.draw();
          }
        });
      });
    }
  });
}

// 공지사항 추가하기
function addNotice() {
  console.log('addNotice() called');

  var title = $('#title').val();
  var context = $('#context').val();
  var time = Date.now().toString();

  var params = {
    TableName: 'noticeTable',
    Item: {
      id: {
        S: uuid()
      },
      title: {
        S: title
      },
      context: {
        S: context
      },
      createdAt: {
        N: time
      },
      updatedAt: {
        N: time
      }
    }
  };

  $('#title').val('');
  $('#context').val('');

  ddb.putItem(params, function(err, data) {
    if (err) {
      console.log('Error', err);
    } else {
      console.log(data);
      $('#noticeTable')
        .DataTable()
        .row.add(params.Item)
        .order([3, 'desc'])
        .draw();
    }
  });
}
