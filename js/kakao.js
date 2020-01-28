// Kakao Init
Kakao.init('7600a0cf289a958df5021746c9222d59');

// Amazon Cognito 인증 공급자를 초기화합니다
AWS.config.region = 'ap-northeast-2'; // 리전
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: 'ap-northeast-2:9293a76a-bac4-4910-9e12-d72bde2351ed'
});
var ddb = new AWS.DynamoDB();

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
        getUserInfo();
      }
    } else {
      alert('로그인이 필요합니다.');
      window.location.replace('/login.html');
    }
  });
});

function setAdmin(uid, isAdmin) {
  if (
    isAdmin == true ||
    isAdmin == false ||
    isAdmin == 'true' ||
    isAdmin == 'false'
  ) {
    Kakao.API.request({
      url: '/v1/user/update_profile',
      data: {
        properties: {
          admin: isAdmin
        }
      },
      success: function(res) {
        console.log(JSON.stringify(res));
      },
      fail: function(error) {
        console.log(JSON.stringify(error));
      }
    });
  } else {
    console.log("setAdmin's isAdmin is invalid", isAdmin);
  }
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
      var table = $('#noticeTable').DataTable({
        data: data.Items,
        columns: [
          { data: 'id.S' },
          { data: 'title.S' },
          { data: 'context.S' },
          { data: 'createdAt.S' },
          { data: 'updatedAt.S' },
          { data: null }
        ],
        columnDefs: [
          {
            targets: -1,
            data: null,
            defaultContent: '<button class="text-danger">X</button>'
          }
        ]
      });

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
  var time = new Date().toISOString();

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
        S: time
      },
      updatedAt: {
        S: time
      }
    }
  };

  ddb.putItem(params, function(err, data) {
    if (err) {
      console.log('Error', err);
    } else {
      console.log(data);
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
