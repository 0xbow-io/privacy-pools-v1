import DotPattern from '@/components/magicui/dot-pattern';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { account } from '@core/account';
import React, { useCallback } from 'react';

import { Keypair, PrivKey, PubKey } from 'maci-domainobjs';

import { KeysSection } from './keys-section';
import { PrivacyKeyUI } from '@core/account';

interface State {
  className: string;
  getKeyList: () => PrivacyKeyUI[];
  genKeyPair: () => void;
}

export default function KeySection({ getKeyList, genKeyPair, className }: State) {
  const RenderKeyListSection = () => {
    return (
      <div className="flex w-full flex-col  gap-10">
        <div className=" border-b-4 border-dominant-blue">
          <h1 className="text-4xl font-normal text-dominant-blue">Privacy Keys: </h1>
        </div>
        <div className="">
          <KeysSection keyList={getKeyList()} />
        </div>
        {GenKeyPairContainer('')}
      </div>
    );
  };

  const RenderCommitmentSection = () => {
    return (
      <div className=" w-full items-start justify-between gap-y-4">
        <div className="border-b-4 border-dominant-blue">
          <h1 className="text-4xl font-normal text-dominant-blue">CTX Records: </h1>
        </div>
        <div className="w-full"></div>
        <div></div>
      </div>
    );
  };

  const ASPSection = () => {
    return (
      <div className="flex w-full flex-col items-start justify-between gap-y-4">
        <div className="border-b-4 border-dominant-blue">
          <h1 className="text-4xl font-normal text-dominant-blue">Associations: </h1>
        </div>
        <div className="w-full"></div>
        <div></div>
      </div>
    );
  };
  const GenKeyPairContainer = (className: string) => {
    return (
      <div
        id="GeneratePrivacyKeyContainer"
        className={cn(
          'relative flex w-full flex-row items-center justify-end gap-x-4 text-font-color duration-300 ease-in',
          className,
        )}
      >
        <div className="flex flex-row  border-b-2 border-b-dominant-blue">
          <Button
            onClick={genKeyPair}
            className="w-full rounded-none border-0 bg-page-background text-lg  font-bold text-font-color hover:bg-font-color hover:text-calming-white"
          >
            Add Key
          </Button>
        </div>
        <div className="flex flex-row  border-b-2 border-b-dominant-blue">
          <Button
            onClick={genKeyPair}
            className="w-full  rounded-none border-0 bg-page-background text-lg font-bold text-font-color hover:bg-font-color hover:text-calming-white"
          >
            Export Keys
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        '3xl:col-span-4 3xl:col-start-3 relative grid gap-x-4  xl:col-span-8 xl:col-start-3 xl:grid-cols-2 xl:grid-rows-1',
        className,
      )}
    >
      <div className="grid-col-2 col-span-2 row-start-1 border-b-4  border-dominant-blue px-4 py-10">
        <h1 className="text-8xl font-normal text-dominant-blue"> Privacy Pool</h1>
      </div>
      <div className="col-span-1 col-start-1 row-span-2 row-start-2 border-dominant-blue   px-4 py-10">
        <RenderKeyListSection />
      </div>
      <div className="col-span-1 col-start-2 row-start-2 border-b-4  border-dominant-blue px-4 py-10">
        <RenderCommitmentSection />
      </div>
      <div className="col-span-1 col-start-2 row-start-3 border-b-4  border-dominant-blue px-4 py-10">
        <ASPSection />
      </div>
    </div>
  );
}
