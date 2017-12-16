var user_ok = false;
var email_ok = false;
var rec_email_ok = false;

$(document).ready(function () {
	var socket = io();

	var login = $('#login');
	var log_user = $('#log_user');
	var log_pwd = $('#log_pwd');
	var signup = $('#signup');
	var sig_user = $('#sig_user');
	var sig_email = $('#sig_email');
	var sig_reemail = $('#sig_reemail');
	var recover = $('#recover');
	var rec_email = $('#rec_email');

	signup.prop('disabled', true);
	recover.prop('disabled', true);

	login.click(function () {
		if(log_user.val().length > 0 && log_pwd.val().length > 0) {
			var msg = {'event': 'login', 'payload': {'user': log_user.val(), 'pwd': log_pwd.val()}};
			socket.emit('message', msg);
		}
	});
	signup.click(function() {
		var msg = {'event': 'rgstr', 'payload': {'user': sig_user.val(), 'email': sig_email.val()}};
		socket.emit('message', msg);
	});
	recover.click(function() {
		var msg = {'event': 'recvr', 'payload': {'email': rec_email.val()}};
		socket.emit('message', msg);
	});
	sig_user.change(function() { userCtrl(); });
	sig_email.change(function() { emailCtrl(); });
	sig_reemail.change(function() { reemailCtrl(); });
	rec_email.change(function() { rec_emailCtrl(); });
	
	sig_user.keyup(function() { userCtrl(); });
	sig_email.keyup(function() { emailCtrl(); });
	sig_reemail.keyup(function() { reemailCtrl(); });
	rec_email.keyup(function() { rec_emailCtrl(); });

	socket.on('message', function(msg) {
		var event = msg['event'];
		if(event !== null && event !== undefined) {
			var payload = msg['payload'];
			switch (event) {
				case 'loggd':
				$.cookie('user', payload['user']);
				$.cookie('session', payload['session']);
				window.location.href='./base.html';
				break;
				case 'signd':
				alert("Utente creato! Seguire le indicazioni contenute nella email per eseguire l'accesso");
				log_user.val(sig_user.val());
				log_pwd.focus();
				sig_user.val('');
				sig_email.val('');
				sig_reemail.val('');
				break;
				case 'mails':
				alert("Se l'email inserita è corretta e registrata si riceverà presto la nuova password");
				rec_email.val('');
				rec_email.focus();
				break;
				case 'error':
				alert(payload['reason']);
				log_pwd.val('');
				sig_user.val('');
				sig_email.val('');
				sig_reemail.val('');
				break;
			}
		}
	});

	function userCtrl() {
		if (sig_user.val().length >= 3 && sig_user.val().length <= 45) user_ok = true;
		else user_ok = false;
		signupCtrl();
	}

	function emailCtrl() {
		if (sig_email.prop('validity').valid) email_ok = true;
		else email_ok = false;
		reemailCtrl();
		signupCtrl();
	}

	function reemailCtrl() {
		if (sig_email.val() == sig_reemail.val()) reemail_ok = true;
		else reemail_ok = false;
		signupCtrl();
	}

	function signupCtrl() {
		if (user_ok && email_ok && reemail_ok)
			signup.prop('disabled', false);
		else
			signup.prop('disabled', true);
	}

	function rec_emailCtrl() {
		if (rec_email.prop('validity').valid) rec_email_ok = true;
		else rec_email_ok = false;
		recoverCtrl();
	}

	function recoverCtrl() {
		if (rec_email_ok)
			recover.prop('disabled', false);
		else
			recover.prop('disabled', true);
	}
});