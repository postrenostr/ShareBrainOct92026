import { TenWordsService } from "./service";
import { tenWordsStore } from "./store";
import { createTenWordsGenerator } from "./generator";
export const tenWordsService = new TenWordsService(tenWordsStore, createTenWordsGenerator());
