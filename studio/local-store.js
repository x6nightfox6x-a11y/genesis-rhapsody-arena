// Same IndexedDB library as studio.html; stores character drafts and revision metadata, never credentials.
let connection;
export function localLibrary() {
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('gra-unified-studio',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('cards',{keyPath:'id'});
    request.onerror=()=>{connection=null;reject(Error('本地角色库不可用，请先导出 JSON 备份。'));};
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>{db.close();connection=null;};
      resolve({
        get:id=>new Promise((resolve,reject)=>{const request=db.transaction('cards','readonly').objectStore('cards').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}),
        put:record=>new Promise((resolve,reject)=>{const transaction=db.transaction('cards','readwrite');transaction.objectStore('cards').put(record);transaction.oncomplete=()=>resolve(record);transaction.onerror=()=>reject(Error('本地保存失败，请先导出 JSON 备份。'));transaction.onabort=()=>reject(Error('本地保存中止，请先导出 JSON 备份。'));})
      });
    };
  });return connection;
}
