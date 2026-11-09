import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {Alert,Pressable,TextInput} from 'react-native';
import AdminInvestmentApplicationScreen from '../src/screens/AdminInvestmentApplicationScreen';
import api from '../src/api';
jest.mock('../src/components/AdminProtectedScreen',()=>({children}:any)=>children);
jest.mock('../src/api',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn()}}));
jest.mock('../src/screens/InvestmentApplicationScreen',()=>({DecisionHistory:'DecisionHistory'}));
jest.mock('@react-native-picker/picker',()=>({Picker:Object.assign(function Picker(props:any){return require('react').createElement('StagePicker',props,props.children);},{Item:'Option'})}));
const application={id:'a1',userId:'owner',propertyId:'p1',requestedAmount:40,requestedShares:4,approvedAmount:null,approvedShares:null,stepNumber:1,status:'pending',createdAt:'2026-11-01T00:00:00Z'};
beforeEach(()=>{jest.clearAllMocks();(api.get as jest.Mock).mockImplementation(async path=>({data:path==='/properties'?[{id:'p1',title:'QA property'}]:[application]}));});
async function open(){let view!:TestRenderer.ReactTestRenderer;await act(async()=>{view=TestRenderer.create(<AdminInvestmentApplicationScreen/>);});await act(async()=>{view.root.findAllByType('StagePicker' as any)[0].props.onValueChange('p1');});return view;}
const button=(view:TestRenderer.ReactTestRenderer,label:string)=>view.root.findAll(x=>x.props.accessibilityLabel===label&&typeof x.props.onPress==='function')[0];
test('native partial decision requires reason and explicit review, with one POST for duplicate confirmation',async()=>{
 let resolve!:(v:any)=>void;(api.post as jest.Mock).mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});const view=await open();
 await act(async()=>button(view,'Accept / partial').props.onPress());expect(api.post).not.toHaveBeenCalled();
 await act(async()=>{view.root.findAllByType(TextInput).find(x=>x.props.accessibilityLabel==='Approved shares')!.props.onChangeText('2');view.root.findAllByType(TextInput).find(x=>x.props.accessibilityLabel==='Decision reason')!.props.onChangeText('Reviewed partial allocation');});
 await act(async()=>button(view,'Accept / partial').props.onPress());
 const [title,message,buttons]=alert.mock.calls.at(-1)!;expect(title).toContain('Confirm');expect(message).toContain('20.00');expect(api.post).not.toHaveBeenCalled();
 const confirm=buttons!.find(x=>x.text==='Confirm')!.onPress!;
 await act(async()=>{confirm();confirm();});expect(api.post).toHaveBeenCalledTimes(1);
 expect((api.post as jest.Mock).mock.calls[0][0]).toBe('/investment-workflow/applications/a1/decision');
 expect((api.post as jest.Mock).mock.calls[0][1]).toMatchObject({action:'accept',approvedShares:2,expectedStep:1,reason:'Reviewed partial allocation'});
 expect((api.post as jest.Mock).mock.calls[0][1].operationId).toMatch(/^[0-9a-f-]{36}$/);
 await act(async()=>resolve({data:{message:'Decision committed'}}));await act(async()=>view.unmount());alert.mockRestore();
});
test('native uncertain decision blocks further writes until reload and history review',async()=>{
 (api.post as jest.Mock).mockRejectedValue(new Error('Response lost'));const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});const view=await open();
 await act(async()=>view.root.findAllByType(TextInput).find(x=>x.props.accessibilityLabel==='Decision reason')!.props.onChangeText('Refund reviewed'));
 await act(async()=>button(view,'Reject and refund').props.onPress());const confirm=alert.mock.calls.at(-1)![2]!.find(x=>x.text==='Confirm')!.onPress!;
 await act(async()=>confirm());expect(api.post).toHaveBeenCalledTimes(1);
 expect(button(view,'Reject and refund').props.disabled).toBe(true);
 await act(async()=>view.unmount());alert.mockRestore();
});
