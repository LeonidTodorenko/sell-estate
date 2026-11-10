import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {TextInput} from 'react-native';
import PaymentEvidence from '../src/components/PaymentEvidence';
import api from '../src/api';
jest.mock('../src/api',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn()}}));
jest.mock('../src/components/BlueButton',()=> 'EvidenceButton');
jest.mock('@react-native-documents/picker',()=>({pick:jest.fn(),isErrorWithCode:()=>false,errorCodes:{OPERATION_CANCELED:'cancel'}}));
beforeEach(()=>{jest.clearAllMocks();(api.get as jest.Mock).mockResolvedValue({data:[]});(api.post as jest.Mock).mockResolvedValue({data:{id:'entry'}});});
test('clarification uses existing payment history and never invokes settlement',async()=>{
 let view!:TestRenderer.ReactTestRenderer;await act(async()=>{view=TestRenderer.create(<PaymentEvidence id="request" admin open/>);});
 const find=()=>view.root.findAllByType('EvidenceButton' as any).find(b=>b.props.title==='Request clarification without declining')!;
 expect(find().props.disabled).toBe(true);
 await act(async()=>view.root.findByType(TextInput).props.onChangeText('Please attach a dated receipt'));
 await act(async()=>find().props.onPress());
 expect(api.post).toHaveBeenCalledTimes(1);expect(api.post).toHaveBeenCalledWith('/payments/request/evidence/clarification',{comment:'Please attach a dated receipt'});
 expect(view.root.findByType(TextInput).props.value).toBe('');await act(async()=>view.unmount());
});
test('closed request retains history but removes submission actions',async()=>{
 (api.get as jest.Mock).mockResolvedValue({data:[{id:'e',kind:'clarification',comment:'Need date',createdAt:'2026-11-10T00:00:00Z',size:0}]});
 let view!:TestRenderer.ReactTestRenderer;await act(async()=>{view=TestRenderer.create(<PaymentEvidence id="closed" open={false}/>);});
 expect(view.root.findAllByType(TextInput)).toHaveLength(0);
 expect(view.root.findAllByType('EvidenceButton' as any)).toHaveLength(1);
 expect(JSON.stringify(view.toJSON())).toContain('Need date');expect(api.post).not.toHaveBeenCalled();await act(async()=>view.unmount());
});
