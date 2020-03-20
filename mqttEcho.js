// ============================ RESOURCES ================================
var mqtt = require('mqtt');
const argParser = require('./argParser').parser;
const fs = require('fs');
// =======================================================================

// ============================ GLOBALS ==================================
const args = argParser.parseArgs();
const configFileRaw = fs.readFileSync(args.config, 'utf-8');
var config = JSON.parse(configFileRaw);

var targetBroker = mqtt.connect(config.targetBroker.url,config.targetBroker.options);
var sourceBroker = mqtt.connect(config.sourceBroker.url,config.sourceBroker.options);

var subscribedSourceBroker = false;
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

function republishTopic(topic, message)
{
	if(typeof(message) != "undefined") 
	{//acounting for broken messages
		for (var i in config.topicsToRepublish)
		{
			if(topic == config.topicsToRepublish[i].sourceTopic)
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
				var payload = {};
				
				for(var o in config.topicsToRepublish[i].keysToRepublish)
				{
					var payloadChunk = config.topicsToRepublish[i].keysToRepublish[o];
					var chunkPathPieces = payloadChunk.sourceKey.split('.');
					payload[payloadChunk.targetKey] = getPayloadChunk(chunkPathPieces, msgJson);
				};
				targetBroker.publish(config.topicsToRepublish[i].targetTopic, JSON.stringify(payload))
			}
		}
	}
}

function subsribeToSourceTopics()
{
	for (var i in config.topicsToRepublish)
	{
		sourceBroker.subscribe(config.topicsToRepublish[i].sourceTopic);
	};
}
// =======================================================================


// =============== Messages from source broker ===========================
sourceBroker.on('connect', function()
{
	console.log("Connected to source Mqtt Broker");
	if(subscribedSourceBroker != true)
	{
		subsribeToSourceTopics();
		subscribedSourceBroker = true;
		console.log("Subsriptions to source broker are done");
	}
});

sourceBroker.on('message', function (topic, message)
{
	console.log(message.toString());
	republishTopic(topic,message);
});

sourceBroker.on('error', function(error)
{
	console.log("Error received from source broker");
	console.log(error);
});
// =======================================================================

// =============== Messages from target broker ===========================
targetBroker.on('connect', function()
{
	console.log("Connected to target Mqtt Broker");
    // saying hi using the target broker
    // can be usefull for potential re-published topics subscribers
    targetBroker.publish(config.mqttTargetGreatingInfos.topic,config.mqttTargetGreatingInfos.mqttEchoInstanceId);
});

targetBroker.on('error', function(error)
{
	console.log("Error received from target broker");
	console.log(error);
});
// =======================================================================
