
import React from 'react';
import Card from '../ui/Card';
import Select from '../ui/Select';
import { useVocabulary } from '../../context/VocabularyContext';
import { FREQUENCIES } from '../../constants';
import { RevisionFrequency } from '../../types';

const SettingsScreen: React.FC = () => {
    const { frequency, setFrequency } = useVocabulary();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Settings</h1>
            <Card className="max-w-md">
                <h2 className="text-xl font-bold mb-4">Revision Program</h2>
                <div className="space-y-4">
                    <Select
                        id="frequency"
                        label="New Vocabulary Frequency"
                        options={FREQUENCIES}
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as RevisionFrequency)}
                    />
                    <p className="text-sm text-gray-500">
                        This setting is a reminder for your personal study plan. The app will not automatically add new words.
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default SettingsScreen;
