var email_ok = false;
var reemail_ok = false;
var pwd_email_ok = false;
var old_pdw_ok = false;
var new_pwd_ok = false;
var renew_pwd_ok = false;

$(document).ready(function() {
	var socket = io();

	var chng_email = $('#chng_email');
	var new_email = $('#new_email');
	var renew_email = $('#renew_email');
	var pwd_email = $('#pwd_email');
	var chng_pwd = $('#chng_pwd');
	var old_pwd = $('#old_pwd');
	var new_pwd = $('#new_pwd');
	var renew_pwd = $('#renew_pwd');

	chng_pwd.prop('disabled', true);
	chng_email.prop('disabled', true);

	chng_pwd.click(function() {
		chng_pwd.prop('disabled', true);
		var msg = {'event': 'chgpw', 'payload': {'old': old_pwd.val(), 'new': new_pwd.val()}};
		socket.emit('message', msg);
	});
	chng_email.click(function() {
		chng_email.prop('disabled', true);
		var msg = {'event': 'chgml', 'payload': {'pwd': pwd_email.val(), 'new': new_email.val()}};
		socket.emit('message', msg);
	});

	new_email.change(function() { emailCtrl(); });
	new_email.keyup(function() { emailCtrl(); });

	renew_email.change(function() { reemailCtrl(); });
	renew_email.keyup(function() { reemailCtrl(); });

	pwd_email.change(function() { pwdCtrl(); });
	pwd_email.keyup(function() { pwdCtrl(); });

	old_pwd.change(function() { opwdCtrl(); });
	old_pwd.keyup(function() { opwdCtrl(); });

	new_pwd.change(function() { npwdCtrl(); });
	new_pwd.keyup(function() { npwdCtrl(); });

	renew_pwd.change(function() { rnpwdCtrl(); });
	renew_pwd.keyup(function() { rnpwdCtrl(); });

	socket.on('message', function(msg) {
		var event = msg['event'];
		if(event !== null && event !== undefined) {
			var payload = msg['payload'];
			switch (event) {
				case 'success':
				alert('Success!');
				break;
				case 'error':
				alert(payload['reason']);
				break;
				case 'pinreq':
				$('#pinDialog').prop('open', true);
				break;
			}
			cleanup();
		}
	});

	function cleanup() {
		chng_email.prop('disabled', true);
		new_email.val('');
		renew_email.val('');
		pwd_email.val('');
		chng_pwd.prop('disabled', true);
		old_pwd.val('');
		new_pwd.val('');
		renew_pwd.val('');
	}

	function emailCtrl() {
		if (new_email.prop('validity').valid) email_ok = true;
		else email_ok = false;
		reemailCtrl();
		changeEmailCtrl();
	}

	function reemailCtrl() {
		if (new_email.val() === renew_email.val()) reemail_ok = true;
		else reemail_ok = false;
		changeEmailCtrl();
	}

	function pwdCtrl() {
		if (pwd_email.val().length >= 1) pwd_email_ok = true;
		else pwd_email_ok = false;
		changeEmailCtrl();
	}

	function opwdCtrl() {
		if (old_pwd.val().length >= 1) old_pdw_ok = true;
		else old_pdw_ok = false;
		changePwdCtrl();
	}

	function npwdCtrl() {
		if (new_pwd.val().length >= 6) new_pwd_ok = true;
		else new_pwd_ok = false;
		rnpwdCtrl();
		changePwdCtrl();
	}

	function rnpwdCtrl() {
		if (new_pwd.val() === renew_pwd.val()) renew_pwd_ok = true;
		else renew_pwd_ok = false;
		changePwdCtrl();
	}

	function changeEmailCtrl() {
		if(email_ok && reemail_ok && pwd_email_ok)
			chng_email.prop('disabled', false);
		else
			chng_email.prop('disabled', true);
	}

	function changePwdCtrl() {
		if(old_pdw_ok && new_pwd_ok && renew_pwd_ok)
			chng_pwd.prop('disabled', false);
		else
			chng_pwd.prop('disabled', true);
	}

	// Dialog

	$('#annulla_pin').click(function() {
		socket.emit('message', {'event': 'chgml_res', 'payload': {'type': 'nok'}});
		$('#pinDialog').prop('open', false);
	});
	$('#sottometti_pin').click(function() {
		socket.emit('message', {'event': 'chgml_res', 'payload': {'type': 'ok', 'pin': $('#pin').val()}});
		$('#pinDialog').prop('open', false);
	});
	$('#pin').change(function() {
		pinCtrl();
	});
	$('#pin').keyup(function() {
		pinCtrl();
	});
	function pinCtrl() {
		if($('#pin').val().length >= 1)
			$('#sottometti_pin').prop('disabled', false);
		else
			$('#sottometti_pin').prop('disabled', true);
	}

});