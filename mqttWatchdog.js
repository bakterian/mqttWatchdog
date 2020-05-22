// ============================ RESOURCES ================================
var mqtt = require('mqtt');
const moment = require('moment-timezone');
const argParser = require('./argParser').parser;
const fs = require('fs');
const mailLogger = require("../xtreamLogger/mailingLogger").MailingLogger;
// =======================================================================

// ============================ GLOBALS ==================================
const args = argParser.parseArgs();
const configFileRaw = fs.readFileSync(args.config, 'utf-8');
var config = JSON.parse(configFileRaw);

var broker = mqtt.connect(config.broker.url,config.broker.options);

var soubscriberBroker = false;

// dictionary holding timeout objecs and the last msg payloads received for a mqttTopic
var timeoutCollection = {};

// =======================================================================

// ================= Gloabl values intilization ==========================
function getDateTime() 
{
   return moment().tz(config.time.zone).format(config.time.format);
}

function doWatchDogNotifcation(topic)
{ 
	//Send out an e-mail with the topic id,
	//last received data and timestamp of the received data 
	//TODO: use a string builder

	console.log("topic is slent: " + topic + ", sending an e-mail");
	var mailMessage = "The mqtt topic: " + topic + " is slent since "
			+ (timeoutCollection[topic].timeoutObj._idleTimeout/60000) +" minutes.<br></br><br></br>"
			+ "This is the data associated with the topic:<br></br>"
			+ "lastMsgData: " + timeoutCollection[topic].lastMsgData + "<br></br>"
			+ "lastMsgTimestamp: " + timeoutCollection[topic].lastMsgTime + "\n";
			
	timeoutCollection[topic].out.error(mailMessage);
}


for(let i in config.topicsToWatch)
{
	   var topicId = config.topicsToWatch[i].topicId;

	   timeoutCollection[topicId] = {
			"timeoutObj"  : setInterval(doWatchDogNotifcation, config.topicsToWatch[i].maxTopicSilenceMs, topicId),
			"lastMsgData" : "not connected to broker yet",
			"lastMsgTime" : getDateTime(),
			"out"	      : new mailLogger(config.loggerOptions)
		}
}

// =======================================================================

// ==================== HELPER FUNCTIONS =================================

function isDictionary(obj)
{
   return ((typeof obj==='object') && 
           (obj!==null) && 
           (!Array.isArray(obj)) && 
           (!(obj instanceof Date)));
}

function getPayloadChunk(pathPieces, obj)
{
  var res = -1;

  if((typeof(obj) != "undefined") &&
      (Array.isArray(pathPieces)) &&
      (pathPieces.length > 0))
  {
    var searchedPiece = pathPieces[0];
    if(isDictionary(obj))
    {
      for(let [k, v] of Object.entries(obj))
      {
        if(k == searchedPiece)
        {
          if(pathPieces.length == 1)
          {//found the payload chunk
            res = v;
          }
          else
          { //remove one piece from the array and recurse deeper
            pathPieces.shift()
            res = getPayloadChunk(pathPieces, v)
          }
        }
        if(res != -1) break;
      }
    }
    else if(Array.isArray(obj))
    {
      for(var i in obj)
      { //verify all array elements
        res = getPayloadChunk(pathPieces, obj[i])
        if(res != -1) break;
      }
    }
    else
    {
      console.log("[getPayloadChunk()] error obj type: " + typeof(obj))
    }
  }

  else
  {
    console.log("[getPayloadChunk()] wrong input args.")
  }

  return res;
}

function checkTopicPayload(topic, message)
{
	var receivedDataIsValid = true;
	if(typeof(message) != "undefined") 
	{//acounting for broken messages
		for (var i in config.topicsToWatch)
		{
			if(topic == config.topicsToWatch[i].topicId)
			{
				var msgJson;
				try
				{
					msgJson = JSON.parse(message.toString());
				}
				catch(e)
				{
					console.log("Error was captured during parsing: " + e.message);
					continue;
				}
				
				for(var o in config.topicsToWatch[i].expectedKeys)
				{
					var expectedKey = config.topicsToWatch[i].expectedKeys[o];
					var chunkPathPieces = expectedKey.split('.');
					receivedDataIsValid = (getPayloadChunk(chunkPathPieces, msgJson) != -1);
					if(!receivedDataIsValid)
					{
						console.log("Error found when checking topic: " + topic + ",the key: " + expectedKey);
						break;
					}
				};
			}
		}
	}
	return receivedDataIsValid; 
}

function subscribeToMqttTopics()
{
	for(var i in config.topicsToWatch)
	{
		broker.subscribe(config.topicsToWatch[i].topicId);
	};
}

function refreshAllTimers()
{
	for(let i in config.topicsToWatch)
	{
       	var topic = config.topicsToWatch[i].topicId;
    	timeoutCollection[topic].timeoutObj.refresh();
		timeoutCollection[topic].lastMsgData = "broker connected no messages yet";
		timeoutCollection[topic].lastMsgTime = getDateTime();
	}
}

function refreshTimer(topicId, msgData)
{
    timeoutCollection[topicId].timeoutObj.refresh();
    timeoutCollection[topicId].lastMsgData = msgData;
    timeoutCollection[topicId].lastMsgTime = getDateTime();
}
// =======================================================================

// ===================== Messages from broker ============================
broker.on('connect', function()
{
	console.log("Connected to source Mqtt Broker");
	if(soubscriberBroker != true)
	{
		subscribeToMqttTopics();
		soubscriberBroker = true;
		console.log("Subsriptions to source broker are done.\n");
		//update all of the running timers
		refreshAllTimers();
	}
});

broker.on('message', function (topic, message)
{
	console.log(message.toString());
	
	//Verify if the topic contains the crutcial data
	var msgPayloadValid = checkTopicPayload(topic,message);
		
	if(msgPayloadValid)
	{
		//all is good update the timestamp value fot this mqttTopic
		console.log("received valid data on watched topic, reseting the watchdog!\n");
		refreshTimer(topic, message);
	}
});

broker.on('error', function(error)
{
	console.log("Error received from source broker");
	console.log(error);
});
// =======================================================================
