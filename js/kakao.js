// Kakao Init
Kakao.init('7600a0cf289a958df5021746c9222d59');

// Amazon Cognito 인증 공급자를 초기화합니다
AWS.config.region = 'ap-northeast-2'; // 리전
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: 'ap-northeast-2:181ba321-7a7e-486d-9f43-3ac178405757',
  RoleArn:
    'arn:aws:iam::383760702031:role/Cognito_photoMapAdminCognitoUnauth_Role'
});
var ddb = new AWS.DynamoDB();

var athena = new AWS.Athena();
var date = new Date();

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

var tableName = 'dev-photoMapTable';
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
            window.location.replace('/');
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
        window.location.replace('/login.html');
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
      window.location.replace('/login.html');
    }
  });
});

function getCardNumber() {
  console.log('getCardNumber() called');

  var params = {
    TableName: 'queryTable',
    ExpressionAttributeValues: {
      ':name': { S: 'cardNumber' }
    },
    KeyConditionExpression: 'queryName = :name'
  };

  ddb.query(params, function(err, data) {
    if (err) {
      console.log('Error', err);
    } else {
      console.log(data.Items[0].id.S);
      getStatus(data.Items[0].id.S, setCardNumber);
    }
  });
}

function getCardNumber_Athena() {
  console.log('getCardNumber_Athena() called');

  var params = {
    QueryExecutionContext: {
      Database: 'photomap_dev_athena'
    },
    QueryString:
      "SELECT 'user' AS name, COUNT(uid) AS count FROM users WHERE " +
      partition() +
      " UNION SELECT 'map', COUNT(mid) FROM maps WHERE " +
      partition() +
      " UNION SELECT 'story', COUNT(sid) FROM stories WHERE " +
      partition() +
      " UNION SELECT 'log', COUNT(lid) FROM logs WHERE " +
      partition(),
    ResultConfiguration: {
      OutputLocation: 's3://aws-glue-photomap-dev/result'
    }
  };
  console.log(params.QueryString);

  athena.startQueryExecution(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log(data);
      getStatus(data.QueryExecutionId, setCardNumber);
    }
  });
}

function setCardNumber(data) {
  var rows = data.ResultSet.Rows;
  console.log(data);
  console.log(rows);

  for (var i = 1; i < rows.length; i++) {
    $('#' + get(rows[i], 0) + 'Number').text(get(rows[i], 1));
  }
}

function get(row, idx, type) {
  if (type) {
    return row.Data[idx][type];
  } else if (idx) {
    return row.Data[idx].VarCharValue;
  } else {
    return row.Data[0].VarCharValue;
  }
}

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

function getUserInfo() {
  console.log('getUserInfo() called');

  var params = {
    TableName: tableName,
    IndexName: 'GSI',
    ExpressionAttributeValues: {
      ':info': { S: 'INFO' },
      ':user': { S: 'USER' }
    },
    KeyConditionExpression: 'SK = :info and types = :user'
  };

  ddb.query(params, function(err, data) {
    if (err) {
      console.log('Error', err);
    } else {
      users = data.Items;
      $('#userNumber').text(users.length);
    }
  });
}

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

function logout() {
  Kakao.Auth.logout();
  window.location.replace('/login.html');
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
