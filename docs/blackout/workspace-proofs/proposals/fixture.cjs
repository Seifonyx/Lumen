// Synthetic account for the Gate1 reconsideration proposals: the existing launch conversation, filed under a
// project with related work, plus a second project and unfiled chats. Never a real user record.
const base=require('../fixture.cjs');
const now=base.now;
const projects=[
 {id:'studio',name:'Studio launch',description:'Offer, portfolio and first clients.',instructions:'Keep plans realistic for one person.',color:'indigo',createdAt:now-30*86400000,updatedAt:now},
 {id:'trip',name:'Lisbon in spring',description:'A slow week, planned together.',instructions:'',color:'green',createdAt:now-20*86400000,updatedAt:now-2*86400000},
];
const file={'launch':'studio','history-1':'studio','history-3':'studio'};
const chats=base.chats.map(c=>({...c,...(file[c.id]?{projectId:file[c.id]}:{})}));
chats.push({id:'lisbon',title:'Four quiet days in Lisbon',projectId:'trip',createdAt:now-3*86400000,updatedAt:now-2*86400000,messages:[{id:'l1',role:'user',text:'Plan four quiet days in Lisbon.',createdAt:now-3*86400000}]});
module.exports={chats,projects,now};
