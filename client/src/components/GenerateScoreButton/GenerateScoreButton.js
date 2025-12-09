import React from 'react';
import { Loader2 } from 'lucide-react';

const GenerateScoreButton = ({
    taskId,
    isLoading,
    onGenerateScore,
    onChangeScore,
    onClick,
    alignmentScore,
    alignmentReason
}) => {
    if (!alignmentScore || alignmentScore === 0) {
        return (
            <button
                onClick={() => onGenerateScore(taskId)}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                    </>
                ) : (
                    'Generate Score'
                )}
            </button>
        );
    }

    return (
        <div className="flex flex-col gap-2" onClick={onClick}>
            <div className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                        className={`h-2.5 rounded-full ${alignmentScore >= 80 ? 'bg-green-500' :
                                alignmentScore >= 50 ? 'bg-yellow-500' :
                                    'bg-red-500'
                            }`}
                        style={{ width: `${alignmentScore}%` }}
                    ></div>
                </div>
                <span className="ml-2 text-sm">{alignmentScore}%</span>
            </div>
            {alignmentReason && (
                <div className="text-xs text-gray-600 mt-1">
                    {alignmentReason}
                </div>
            )}
        </div>
    );
};

export default GenerateScoreButton;