import { createAction } from 'nango';
import * as z from 'zod';
export default createAction({description:'CG Read: list sites.',version:'1.0.0',input:z.object({
  }),output:z.any(),exec:async(nango)=>{const response=await nango.get({endpoint:`/v3/sites`});return response.data;}});
