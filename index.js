var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http');
var multer = require('multer');
var querystring = require('querystring');
var random = require('random-js')();
var request = require('request');
var secrets = require('./secrets');

var server = http.Server(app);
var io = require('socket.io')(server);

var USERS = {};

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(multer()); // for parsing multipart/form-data

function postSlackMessage(data) {
    var headers = {
      'User-Agent': 'WakaTime Chat/0.0.1',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
    data.token = secrets.slack_token;
    var options = {
      method: 'POST',
      url: 'https://slack.com/api/chat.postMessage',
      headers: headers,
      form: data,
    };

    request(options, function (error, response, body) {
        console.log(response.statusCode);
        console.log(body);
    });
}

io.on('connection', function(socket) {
  socket.id = random.string(6);
  USERS[socket.id] = socket;
  console.log('User ' + socket.id + ' has joined.');

  socket.on('disconnect', function() {
    delete USERS[socket.id];
    console.log('User ' + socket.id + ' has left.');
  });

  socket.on('message', function(data) {
    var text = data.from + '(' + socket.id + '): ' + data.text;
    postSlackMessage({
      'channel': secrets.slack_channel,
      'text': text,
      'username': 'WakaTime',
      'icon_url': 'https://wakatime.com/static/img/wakatime-48.png',
    });
  });
});

app.get('/', function(req, res) {
  res.writeHead(302,
    {Location: 'https://wakatime.com/slack'}
  );
  res.end();
});

app.post('/webhooks/slack', function(req, res) {
  if (req.body['token'] === secrets.command_token) {
    var id;
    var text = req.body['text'];
    if (text) {
      id = text.split(' ')[0];
      text = text.slice(id.length + 1);
    }
    if (id && USERS[id]) {
      USERS[id].emit('message', { from: 'alan', text: text });
      res.status(201).send(JSON.stringify({}));
    } else {
      res.status(400).send(JSON.stringify({error: 'user is offline.'}));
    }
  } else {
    res.status(403).send(JSON.stringify({error: 'invalid token.'}));
  }
});

server.listen(secrets.port, function() {
  console.log('listening on *:'+secrets.port+'.');
});
