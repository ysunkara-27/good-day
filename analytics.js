(function(){
  if(location.hostname==='localhost'||location.hostname==='127.0.0.1')return;
  var API='https://hooraas-rides-api.sunkarayashaswi.workers.dev',key='ys-analytics-id',visitor;
  try{visitor=localStorage.getItem(key);if(!/^[a-zA-Z0-9_-]{8,160}$/.test(visitor||'')){visitor=crypto.randomUUID();localStorage.setItem(key,visitor);}}catch{visitor=crypto.randomUUID();}
  window.siteAnalyticsId=visitor;
  var body=JSON.stringify({site:'taskpup',path:location.pathname,visitor:visitor});
  if(navigator.sendBeacon){navigator.sendBeacon(API+'/analytics/event',new Blob([body],{type:'text/plain'}));}
  else fetch(API+'/analytics/event',{method:'POST',body:body,keepalive:true}).catch(function(){});
})();
