// Kakao Init
Kakao.init('7600a0cf289a958df5021746c9222d59');

var server = 'https://soybeans.tech/dev';
var myInfo; // 카카오에서 가져온 내 정보

function createLoginButton() {
  // 카카오 로그인 버튼을 생성합니다.
  Kakao.Auth.createLoginButton({
    container: '#kakao-login-btn',
    success: function(authObj) {
      console.log('Login success', JSON.stringify(authObj));
      window.location.replace('/');
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
      // 로그인 성공
      console.log('success Login');
      myInfo = statusObj.user;
      $('#userDropdown > span').text(myInfo.kakao_account.profile.nickname);
      $('#userDropdown > img').attr(
        'src',
        myInfo.kakao_account.profile.thumbnail_image_url
      );
    } else {
      alert('로그인이 필요합니다.');
      Kakao.Auth.logout();
      window.location.replace('/login.html');
    }
  });
});

/* 공용 */
// 로그아웃
function logout() {
  Kakao.Auth.logout();
  window.location.replace('/login.html');
}

$.ajaxSetup({
  beforeSend: function(xhr) {
    xhr.setRequestHeader(
      'Authorization',
      'Bearer ' + Kakao.Auth.getAccessToken()
    );
  }
});

var API = Object.freeze({
  UserGet: ['GET', '/users'],
  UserDelete: ['DELETE', '/users'],
  UserPrimaryMap: function(mid) {
    return ['PATCH', '/users/' + mid];
  },
  MapList: ['GET', '/maps'],
  MapMake: ['POST', '/maps'],
  MapInfo: function(mid) {
    return ['GET', '/maps/' + mid];
  },
  MapSetRepresent: function(mid) {
    return ['POST', '/maps/' + mid];
  },
  MapEditName: function(mid) {
    return ['PUT', '/maps/' + mid];
  },
  MapModifyUser: function(mid) {
    return ['PATCH', '/maps/' + mid];
  },
  MapDelete: function(mid) {
    return ['DELETE', '/maps/' + mid];
  },
  StoryUpload: function(mid) {
    return ['POST', '/stories/' + mid];
  },
  StoryList: function(mid, cityKey) {
    return ['GET', '/stories/' + mid + '/' + cityKey];
  },
  StoryInfo: function(sid) {
    return ['GET', '/stories/' + sid];
  },
  StoryModify: function(sid) {
    return ['PATCH', '/stories/' + sid];
  },
  StoryDelete: function(sid) {
    return ['DELETE', '/stories/' + sid];
  },
  NoticeGet: ['GET', '/notice']
});

function request(api, data) {
  console.log('request', api, data);
  var settings = {
    method: api[0],
    dataType: 'json'
  };
  if (data) {
    settings.data = data;
  }
  $.ajax(server + api[1], settings);
}
