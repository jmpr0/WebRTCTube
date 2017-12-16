var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require('fs');
var cookie = require('cookie');
var options = {
	key: fs.readFileSync('./certificate/key.pem', 'utf8'),
	cert: fs.readFileSync('./certificate/cert.crt', 'utf8')
};
var https = require('https').createServer(options, app);
var ios = require('socket.io')(https);
var janus_http = require('https'); // Poichè NodeJS e Janus risiedono sullo stesso host è rimandata la gestione dei certificati, ovvero si utilizza http.
var janus_option = {
	hostname: 'localhost',
	port: 7088,
	path: '/admin',
	method: 'POST',
	headers: {
		'Content-Type': 'application/json'
	}
};

var mysql = require('mysql');
var nodemailer = require('nodemailer');
var crypto = require('crypto');
var moment = require('moment');

// MySQL error codes
var NO_TABLE = 1146;
var DUPLICATE = 1062;

var MYSQL_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

var data_path = './data/'; // A script will convert from vp8/opus to vp8/vorbis saved files contained in temp folder. New files will save in data folder.

app.use(express.static('web'));

io.on('connection', function(socket) {
	connectionHandler(socket);
});
ios.on('connection', function(socket) {
	connectionHandler(socket);
});

http.listen(80, function() {
	console.log('Server http listening on port 80!');
});
https.listen(443, function() {
	console.log('Server https listening on port 443!');
});

var con = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "password"
});

var service_email = 'webrtctube@gmail.com';

var transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: service_email,
		pass: 'password'
	}
});

con.connect(function(err) {
	if (err) throw err;
	console.log("MySQL connected!");
});

setInterval(function() {
	console.log('Video CleanUP...');
	var date45mless = moment().subtract(45, 'minutes').format(MYSQL_DATE_FORMAT);
	con.query("select id from server.videos where date < " + mysql.escape(date45mless), function(err, result) {
		if(err) {
			if(err.errno !== NO_TABLE) console.log(err.errno);
		} else {
			var j = 0;
			for (var i = 0; i < result.length; i++) {
				fs.unlink(data_path + result[i].id + '.webm', function(err) {
					if (err && err.code === 'EBUSY') {
						tryToDeleteFileIn5Seconds(data_path + result[j].id + '.webm'); 	// I metadati saranno rimossi dal server
					}																	// Nel caso in cui il file sia aperto da qualcuno, sarà cancellato appena sbloccato.
					j++;
				});
			}
			con.query("delete from server.videos where date < " + mysql.escape(date45mless), function(err) {
				if(err) {
					if(err.errno !== NO_TABLE) console.log(err.errno);
				}
			});
		}
	});
	console.log('Video CleanUP complete!');
}, 60000);

function tryToDeleteFileIn5Seconds(name) {
	setTimeout(function() {
		fs.unlink(name, function(err) {
			if(err && err.code == 'EBUSY') return tryToDeleteFileIn5Seconds(name);
		});
	}, 5000);
}

var users = {};
var sessions = {};

var attempts = {};
var MAX_ATTEMPTS = 5;

var emailstochange = {};

function connectionHandler(socket) {

	var cook = {};

	if(socket.handshake.headers.cookie) {
		cook = cookie.parse(socket.handshake.headers.cookie);
		if(securityCheck()) {
			var msg = {'event': 'loggd', 'payload': {'user': cook.user, 'session': cook.session}};
			sendMsg(msg);
			console.log('logged emitted to ' + cook.user + ' ' + mysql.escape(cook.session));
		}
	}

	socket.on('message', function(msg) {
		var event = msg['event'];
		if(event !== null && event !== undefined) {
			if(event !== 'login' && event !== 'rgstr' && !securityCheck())
				return;
			var payload = msg['payload'];
			switch (event) {
				case 'login':
				login(payload);
				break;
				case 'lgout':
				logout();
				break;
				case 'rgstr':
				register(payload);
				break;
				case 'ldreq':
				loadrequests();
				break;
				case 'lkfor':
				lookingfor(payload);
				break;
				case 'cnnwt':
				connectwith(payload);
				break;
				case 'dcnwt':
				disconnectwith(payload);
				case 'okreq':
				okrequest(payload);
				break;
				case 'nkreq':
				nokrequest(payload);
				break;
				case 'ldcnt':
				loadcontacts();
				break;
				case 'svvid':
				savevideo(payload);
				break;
				case 'ldvid':
				loadvideos();
				break;
				case 'recvr':
				recoverPassword(payload);
				break;
				case 'chgpw':
				changePassword(payload);
				break;
				case 'chgml':
				changeEmail(payload);
				break;
				case 'chgml_res':
				emailstochange(payload);
				break;
			}
		}
	});

	function lookingfor(payload) {
		var query = payload['query'];
		var user = cook.user;

		console.log("Search for " + query + ".");
		var sql = "select user from server.users where user like '" + query + "%' and user not in (select user from server." + user + "_conn)";
		con.query(sql, function(err, result) {
			if(err) console.log(err.errno);
			list = [];
			for (var i = 0; i < result.length; i++) {
				if(result[i].user !== user)
					list[i] = result[i].user;
			}
			if (list.length > 0){
				var msg = {'event': 'found', 'payload': {'list': list}};
				sendMsg(msg);
			}
		});
	}

	function login(payload) {
		var user = payload['user'];

		if(!attempts[user])
			attempts[user] = 0;

		if(attempts[user] < MAX_ATTEMPTS)		//SEC_WARN To avoid attempts[user] overflow
			attempts[user] += 1;

		if(!attemptsCheck(user)) return;

		var pwd = payload['pwd'];
		console.log(user);
		var sql = 'select hash from server.users where user = ' + mysql.escape(user); //SEC_WARN Use of like instead = permit the bypass of attempts with users like "user%" "user%%" "user%%%..."
		console.log(sql);

		con.query(sql, function(err, result) {
			if (err) {
				if (err.errno == NO_TABLE) {
					con.query("create table server.users (`user` varchar(45) not null, `hash` varchar(64) not null, primary key (`user`));", function(err, result) {
						if(err) console.log("NoTable: " + err.errno);
					});
					var msg = {'event': 'error', 'payload': {'reason': 'Nessun utente registrato'}};
					sendMsg(msg);
					console.log('Not logged');
					return;
				} else console.log(err.errno);
			}
			var hash = digest(pwd);
			if (result.length > 0 && hash == result[0].hash) {
				cook.user = user;
				cook.session = randomString(16); // check if last session is closed properly and use old session value instead of make new one.
				while(sessions[cook.session] !== null && sessions[cook.session] !== undefined) {
					cook.session = randomString(16); // to guarantee unicity of active session number
				}
				sessions[cook.session] = cook;
				users[cook.user] = cook;
				var msg = {'event': 'loggd', 'payload': {'user': cook.user, 'session': cook.session}};
				sendMsg(msg);
				console.log('logged emitted to ' + cook.user + ' ' + mysql.escape(cook.session));
				delete attempts[user];

				var add_token = {
					'janus': 'add_token',
					'token': cook.session,
					'transaction': randomString(12),
					'admin_secret': 'janusoverlord'
				};
				sendMsgToJanus(add_token);

				return;
			}
			var msg = {'event': 'error', 'payload': {'reason': 'Utente o Password errati. Tentativi rimasti: ' + (MAX_ATTEMPTS - attempts[user])}};
			sendMsg(msg);
			console.log('nlogged emitted');
		});
	}

	function attemptsCheck(user) {
		if(attempts[user] && attempts[user] >= MAX_ATTEMPTS) {
			var msg = {'event': 'error', 'payload': {'reason': 'Numero massimo di tentativi effettuati: reimpostare password'}};
			sendMsg(msg);
			console.log('nlogged emitted');
			return false;
		}
		return true;
	}

	function loadrequests() {
		var user = cook.user;

		console.log('Requests required by ' + user);

		var requests = [];

		var sql = "select user from server." + user + "_req";

		con.query(sql, function(err, result) {
			if(err && err.errno == NO_TABLE) {
				con.query("create table server." + user + "_req (`id` int not null auto_increment, `user` varchar(45) not null, primary key (`id`), unique index `user_unique` (`user` asc));", function(err, result) {
					if(err) console.log("NoTable: " + err.errno);
				});
				return;
			}
			if(!err && result.length > 0) {
				for(i = 0; i < result.length; i++) {
					requests[i] = result[i].user;
				}
				var msg = {'event': 'rqsts', 'payload': {'requests': requests}};
				sendMsg(msg);
			}
		});
	}

	function connectwith(payload) {
		var user = cook.user;
		var target = payload['target'];

		var sql = "select user from server.users where user = " + mysql.escape(target);
		con.query(sql, function(err, result) {
			if(!err && result.length === 1) {
				if(users != {} && users[target] != undefined) {
					console.log("Request send, user " + target + " is connected.");
					var msg = {'event': 'rqsts', 'payload': {'requests': user}};
					// send message to target ?
				}

				var sql = "insert into server." + target + "_req set ?";
				var values = {
					id: 0,
					user: user
				};

				con.query(sql, values, function(err, result) {
					if(err && err.errno == NO_TABLE) {
						con.query("create table server." + target + "_req (`id` int not null auto_increment, `user` varchar(45) not null, primary key (`id`), unique index `user_unique` (`user` asc));", function(err, result) {
							if(err) console.log("NoTable: " + err.errno);
						});
						con.query(sql, values, function(err, result) {
							if(err) console.log("Fatal: " + err.errno);
						});
					} else {
						console.log("Request from " + user + " to " + target + " stored.");
					}
				});
			}
		});
	}

	function disconnectwith(payload) {
		var user = cook.user;
		var target = payload['target'];

		var sql = "select user from server.users where user = " + mysql.escape(target);
		con.query(sql, function(err, result) {
			if(!err && result.length === 1) {
				deleteFromTable(user, target, 'req');
				deleteFromTable(target, user, 'req');
				deleteFromTable(user, target, 'conn');
				deleteFromTable(target, user, 'conn');
			}
		});
	}

	function okrequest(payload) {
		console.log("Confirmation request");
		var user = cook.user;
		var requestor = payload['requestor'];
		createConn(user, requestor);
		createConn(requestor, user);
		deleteFromTable(user, requestor, 'req');
	}

	function nokrequest(payload) {
		console.log("Declination request");
		var user = cook.user;
		var requestor = payload['requestor'];
		deleteFromTable(user, requestor, 'req');
	}

	function loadcontacts() {
		var user = cook.user;
		console.log("Loading contacts of " + user);
		var sql = "select user from server." + user + "_conn";
		con.query(sql, function(err, result) {
			if(err) console.log(err.errno);
			else {
				var contacts = [];
				for(i = 0; i < result.length; i ++) {
					contacts[i] = {};
					contacts[i].user = result[i].user;
					if(users[contacts[i].user])
						contacts[i].online = true;
					else
						contacts[i].online = false;
				}
				var msg = {'event': 'cntcs', 'payload': {'contacts': contacts}};
				sendMsg(msg);
			}
		});
	}
	
	function savevideo(payload) {
		var user = cook.user;
		var name = payload['video']['name'];
		var video = payload['video']['blob'];
		var duration = payload['video']['duration'];

		var id = randomNumber(15);

		var sql = "insert into server.videos set ?";
		var values = {
			id: id,
			user: user,
			name: name,
			date: moment().subtract(duration, 'milliseconds').format(MYSQL_DATE_FORMAT) // Si potrebbe anche utilizzare la data di inizio registrazione, ma prevederebbe sincronismo tra client e server.
		};

		con.query(sql, values, function(err) {
			if(err && err.errno == DUPLICATE) {
				savevideo(payload);
				return; // To interrupt recursion
			} else if(err && err.errno == NO_TABLE) {
				con.query("create table server.videos (`id` varchar(15) not null, `user` varchar(45) not null, `name` varchar(45) not null, `date` datetime(0) not null, primary key (`id`));", function(err) {
					if(err) console.log("NoTable: " + err.errno);
					else
						con.query("alter table `server`.`videos` add index `user_idx` (`user` asc);alter table `server`.`videos` add constraint `user` foreign key (`user`) references `server`.`users` (`user`) on delete cascade on update cascade;", function(err) {
							if(err) console.log(err.errno);
						});
				});
				con.query(sql, values, function(err) {
					if(err) console.log("Fatal: " + err);
				});
			} else if(err) {
				console.log(err.errno)
				console.log("Video stored.");
				var msg = {'event': 'error', 'payload': {'reason': 'MySql error n. ' + err.errno}};
				sendMsg(msg);
				return;
			}
			var file_name = id + '.webm';

			fs.writeFile(data_path + file_name, video, function(err) {
				if(err) {
					fs.mkdir(data_path, function(err) {
						if (err) console.log(err.errno);
						else fs.writeFile(data_path + file_name);
					});
				}
			});

			console.log("Video stored.");
			var msg = {'event': 'vidsv'};
			sendMsg(msg);
		});
	}

	function loadvideos() {
		var user = cook.user;
		var contacts = [];
		var sql = "select user from server." + user + "_conn";
		var k = 0;
		con.query(sql, function(err, result) {
			if(err) console.log(err.errno);
			else {
				for(var i = 0; i < result.length; i ++) {
					contacts[i] = result[i].user;
					console.log('Loading videos of ' + contacts[i] + ' for ' + user);
					var sql = "select id, name from server.videos where user = " + mysql.escape(contacts[i]) + " order by date desc";
					con.query(sql, function(err, result) {
						if(err) {
							if(err.errno !== NO_TABLE) console.log(err.errno);
						}
						else {
							var videos = [];
							for (var j = 0; j < result.length; j++) { // I video sono salvati in ordine inverso per visualizzare dapprima i più nuovi
								videos[j] = {};
								videos[j].id = parseInt(result[j].id);
								videos[j].name = result[j].name;
							}
							var msg = {
								'event': 'vids',
								'payload': {
									'contact': contacts[k],
									'videos': videos
								}
							};
							sendMsg(msg);
							k++;
						}
					});
				}
			}
		});
	}

	function register(payload) {
		var user = payload['user'];
		var email = payload['email'];
		var pwd = randomString(10);

		var mailOpt = {
			from: service_email,
			to: email,
			subject: 'Welcome to WebRTCTube!',
			html:
				'<h1>Welcome to WebRTCTube, ' + user + '!</h1>' +
				'<h3>This is your password to login!</h3>' +
				'<h2>' + pwd + '</h2>' +
				'<h3>If you don\'t like change it after authentication =D</h3>'
		};

		transporter.sendMail(mailOpt, function(err, info) {
			if(err) {
				var msg = {'event': 'error', 'payload': {'reason': err}};
				sendMsg(msg);
				console.log('nsigned emitted');
				return;
			}

			var hash = digest(pwd);

			var sql = "insert into server.users set ?";
			var values = {
				user: user,
				email: email,
				hash: hash
			};

			con.query(sql, values, function(err, result) {
				if (err) {
					if (err.errno == NO_TABLE) {
						con.query("create table server.users (`user` varchar(45) not null, `email` varchar(45) not null, `hash` varchar(64) not null, primary key (`user`), unique index `email_unique` (`email` asc));", function(err, result) {
							if(err) console.log("NoTable: " + err.errno);
							con.query(sql, function(err, result) {});
						});
					} else {
						console.log(err.errno);
						var msg = {'event': 'error', 'payload': {'reason': 'Nome utente o email già utilizzati'}};
						sendMsg(msg);
						console.log('nsigned emitted');
						return;
					}
				}
				var msg = {'event': 'signd'};
				sendMsg(msg);
				console.log('signed emitted');
			});
		});
	}

	function recoverPassword(payload) { // Se l'email corrisponde ad un utente, allora si invia la nuova password. Se la nuova password è inviata con successo, la si aggiorna nel db.
		var msg = {'event': 'mails'};	// A prescindere si invierà un messaggio di success per evitare guessing.
		sendMsg(msg);

		var email = payload['email'];

		var sql = 'select user from server.users where email = ' + mysql.escape(email);

		con.query(sql, function(err, result) {
			if(err) {
				console.log(err.errno);
				return;
			}
			var newpwd = randomString(10);
			var newhash = digest(newpwd);

			var user = result[0].user;

			var mailOpt = {
				from: service_email,
				to: email,
				subject: 'Recover WebRTCTube password!',
				html:
					'<h1>HI ' + user + '!</h1>' +
					'<h3>This is your new password, as you required!</h3>' +
					'<h2>' + newpwd + '</h2>' +
					'<p>If you think this is not for you: FORGETS!'
			};

			transporter.sendMail(mailOpt, function(err) {
				if(err) {
					console.log(err.errno);
					return;
				}

				sql = 'update server.users set hash = ' + mysql.escape(newhash) + ' where user = ' + mysql.escape(user);

				con.query(sql, function(err) {
					if (err) console.log(err.errno);
				});
			});
		});
	}

	function logout() {
		var user = cook.user;
		var session = cook.session;

		var remove_token = {
			'janus': 'remove_token',
			'token': session,
			'transaction': randomString(12),
			'admin_secret': 'janusoverlord'
		};
		sendMsgToJanus(remove_token);

		delete sessions[session];
		delete users[user];
		console.log("Logout per " + user + "...");
	}

	function sendMsg(msg) {
		socket.emit('message', msg);
	}

	function sendMsgToJanus(msg) {
		var janus_req = janus_http.request(janus_option);
		janus_req.on('error', function(err) {
			console.log(err.errno);
		});
		janus_req.write(JSON.stringify(msg));
		janus_req.end();

		console.log("Message sent to Janus: " + JSON.stringify(msg));
	}

	function deleteFromTable(user, requestor, table) {
		con.query("delete from server." + user + "_" + table + " where user=" + mysql.escape(requestor), function(err) {
			if(err) console.log(err.errno);
			else console.log('Request deleted');
		});
	}

	function createConn(user1, user2) {

		var sql = "insert into server." + user1 + "_conn set ?";
		var values = {
			id: 0,
			user: user2
		};

		con.query(sql, values, function(err, result) {
			if(err) {
				if(err.errno == NO_TABLE) {
					con.query("create table server." + user1 + "_conn (`id` int not null auto_increment, `user` varchar(45) not null, primary key (`id`), unique index `user_unique` (`user` asc))", function(err, result) {
						if(err) console.log("NoTable: " + err.errno);
					});
				}
				con.query(sql, values, function(err, result) {
					if(err) console.log("Fatal: " + err.errno);
				});
			}
		});
	}

	function changePassword(payload) {
		var user = cook.user;
		var old_pwd = payload['old'];
		var new_pwd = payload['new'];

		var oldhash = digest(old_pwd);

		var sql = 'select hash from server.users where user = ' + mysql.escape(user);

		con.query(sql, function(err, result) {
			if(err)
				sendMsg({'event': 'error', 'payload': {'reason': 'Generic DB error'}});
			else if(result.length > 0 && oldhash == result[0].hash) {
				var newhash = digest(new_pwd);
				sql = 'update server.users set hash = ' + mysql.escape(newhash) + ' where user = ' + mysql.escape(user);
				con.query(sql, function(err) {
					if(err)
						sendMsg({'event': 'error', 'payload': {'reason': 'Generic DB error'}});
					else
						sendMsg({'event': 'success'});
				});
			} else
				sendMsg({'event': 'error', 'payload': {'reason': 'Password errata'}});
		});
	}

	function changeEmail(payload) {
		var user = cook.user;
		var new_email = payload['new'];
		var pwd = payload['pwd'];

		var hash = digest(pwd);

		var sql = 'select hash from server.users where user = ' + mysql.escape(user);

		con.query(sql, function(err, result) {
			if(err)
				sendMsg({'event': 'error', 'payload': {'reason': 'Generic DB error'}});
			else if(result.length > 0 && hash == result[0].hash) {
				var pin = randomNumber(5);

				var mailOpt = {
					from: service_email,
					to: new_email,
					subject: 'Confirm your new WebRTCTube email!',
					html:
						'<h1>HI ' + user + '!</h1>' +
						'<h3>This is the pin you have to insert!</h3>' +
						'<h2>' + pin + '</h2>' +
						'<p>If you think this is not for you: FORGETS!'
				};

				transporter.sendMail(mailOpt, function(err) {
					if(err)
						sendMsg({'event': 'error', 'payload': {'reason': 'Ci sono problemi con l\'email inserita...'}});
					else {
						var that = {};
						that.new_email = new_email;
						that.pin = pin;
						emailstochange[user] = that;
						sendMsg({'event': 'pinreq'});
					}
				});
			} else
				sendMsg({'event': 'error', 'payload': {'reason': 'Password errata'}});
		});
	}

	function emailstochange(payload) {
		var user = cook.user;
		var type = payload['type'];

		if(type == 'ok' && emailstochange[user]) {
			var pin = payload['pin'];
			if(pin == emailstochange[user].pin) {
				sql = 'update server.users set email = ' + mysql.escape(emailstochange[user].new_email) + ' where user = ' + mysql.escape(user);
				con.query(sql, function(err) {
					if(err)
						sendMsg({'event': 'error', 'payload': {'reason': 'Generic DB error'}});
					else
						sendMsg({'event': 'success'});
				});
			}
		}

		delete emailstochange[user];
	}

	function randomString(len) {
		var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		var randomString = '';
		for (var i = 0; i < len; i++) {
			var randomPoz = Math.floor(Math.random() * charSet.length);
			randomString += charSet.substring(randomPoz,randomPoz+1);
		}
		return randomString;
	}

	function randomNumber(len) {
		if(len > 15){ // len dev'essere <= 15 per evitare di superare Number.MAX_SAFE_INTEGER (9007199254740991).
			console.log("[WARN]: maximum length of randomNumber is 15, but do you want " + len + ". Maximum length setted.");
			len = 15;
		}
		var seed = Math.random();
		if(seed < .1)		// To avoid generation of len-1 randomNumber
			seed += .1;
		var randomNumber = Math.floor(seed * Math.pow(10, len));

		return randomNumber;
	}

	function securityCheck() {
		var user = cook.user;
		var session = cook.session;
		if(sessions != {} && sessions[session] !== undefined && sessions[session] !== null && users != {} && users[user] !== undefined && users[user] !== null && sessions[session].user === users[user].user && sessions[session].session === users[user].session)
			return true;
		console.log("Disconnect.");
		return false;
	}

	function digest(pwd) {
		var cipher = crypto.createHash('sha256');
		cipher.update(pwd);
		return cipher.digest('hex');
	}
}