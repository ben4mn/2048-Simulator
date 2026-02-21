/**
 * RuleBuilder Component
 * Main rule set builder with three input modes: Drag & Drop, Arrow Keys, LLM
 */

import React, { useState, useCallback } from 'react';
import type { Direction, Rule, RuleSet } from '../engine/types';
import RuleCard from './RuleCard';
import DirectionPalette from './DirectionPalette';
import ArrowKeyInput from './ArrowKeyInput';
import LLMRuleGenerator from './LLMRuleGenerator';
import RuleSetPreview from './RuleSetPreview';

type InputMode = 'drag_drop' | 'arrow_keys' | 'llm';

interface RuleBuilderProps {
  ruleSet: RuleSet | null;
  onChange: (ruleSet: RuleSet) => void;
  savedRuleSets: RuleSet[];
  onSave: (ruleSet: RuleSet) => void;
  onLoad: (ruleSet: RuleSet) => void;
  onDelete: (id: string) => void;
}

let ruleIdCounter = 0;
function nextRuleId(): string {
  return `rule_${Date.now()}_${++ruleIdCounter}`;
}

function createDefaultRuleSet(): RuleSet {
  return {
    id: `rs_${Date.now()}`,
    name: 'My Rule Set',
    rules: [],
    source: 'manual',
  };
}

function directionsToRuleSet(directions: Direction[], existing: RuleSet | null): RuleSet {
  const rules: Rule[] = directions.map((dir, i) => ({
    id: nextRuleId(),
    direction: dir,
    condition: { type: 'always' as const },
    priority: i,
  }));

  return {
    ...(existing || createDefaultRuleSet()),
    rules,
    source: 'arrow_keys',
  };
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  ruleSet,
  onChange,
  savedRuleSets,
  onSave,
  onLoad,
  onDelete,
}) => {
  const [mode, setMode] = useState<InputMode>('drag_drop');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [ruleSetName, setRuleSetName] = useState(ruleSet?.name || 'My Rule Set');
  const [showSaved, setShowSaved] = useState(false);

  const currentRuleSet = ruleSet || createDefaultRuleSet();
  const rules = currentRuleSet.rules;

  // ---- Drag & Drop handlers ----
  const handleAddDirection = useCallback((direction: Direction) => {
    const newRule: Rule = {
      id: nextRuleId(),
      direction,
      condition: { type: 'always' },
      priority: rules.length,
    };
    onChange({
      ...currentRuleSet,
      rules: [...rules, newRule],
      source: 'manual',
    });
  }, [currentRuleSet, rules, onChange]);

  const handleDropFromPalette = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dir = e.dataTransfer.getData('direction') as Direction;
    if (dir) {
      handleAddDirection(dir);
    }
    setDragOverIndex(null);
  }, [handleAddDirection]);

  const handleRuleDragStart = useCallback((_e: React.DragEvent, index: number) => {
    setDragSourceIndex(index);
  }, []);

  const handleRuleDragOver = useCallback((_e: React.DragEvent, index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleRuleDragEnd = useCallback(() => {
    if (dragSourceIndex !== null && dragOverIndex !== null && dragSourceIndex !== dragOverIndex) {
      const newRules = [...rules];
      const [moved] = newRules.splice(dragSourceIndex, 1);
      newRules.splice(dragOverIndex, 0, moved);
      // Reassign priorities
      const reindexed = newRules.map((r, i) => ({ ...r, priority: i }));
      onChange({ ...currentRuleSet, rules: reindexed });
    }
    setDragSourceIndex(null);
    setDragOverIndex(null);
  }, [dragSourceIndex, dragOverIndex, rules, currentRuleSet, onChange]);

  const handleUpdateRule = useCallback((id: string, updates: Partial<Rule>) => {
    const newRules = rules.map(r => r.id === id ? { ...r, ...updates } : r);
    onChange({ ...currentRuleSet, rules: newRules });
  }, [currentRuleSet, rules, onChange]);

  const handleRemoveRule = useCallback((id: string) => {
    const newRules = rules.filter(r => r.id !== id).map((r, i) => ({ ...r, priority: i }));
    onChange({ ...currentRuleSet, rules: newRules });
  }, [currentRuleSet, rules, onChange]);

  // ---- Arrow key handlers ----
  const arrowSequence: Direction[] = rules.map(r => r.direction);

  const handleArrowSequenceChange = useCallback((dirs: Direction[]) => {
    onChange(directionsToRuleSet(dirs, currentRuleSet));
  }, [currentRuleSet, onChange]);

  // ---- LLM handler ----
  const handleLLMGenerated = useCallback((generated: RuleSet) => {
    onChange({
      ...generated,
      id: currentRuleSet.id,
      name: generated.name || ruleSetName,
    });
    // Switch to drag & drop mode to allow editing
    setMode('drag_drop');
  }, [currentRuleSet.id, ruleSetName, onChange]);

  // ---- Save handler ----
  const handleSave = () => {
    const toSave = { ...currentRuleSet, name: ruleSetName };
    onChange(toSave);
    onSave(toSave);
  };

  const handleClearAll = () => {
    onChange({ ...currentRuleSet, rules: [] });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Rule Builder</h2>
        <p className="text-amber-100 text-sm mt-0.5">Design your move strategy</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Rule Set Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
            Rule Set Name
          </label>
          <input
            type="text"
            value={ruleSetName}
            onChange={(e) => {
              setRuleSetName(e.target.value);
              onChange({ ...currentRuleSet, name: e.target.value });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            placeholder="Name your strategy..."
          />
        </div>

        {/* Mode Tabs */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          {([
            { key: 'drag_drop' as InputMode, label: 'Drag & Drop', icon: '{}' },
            { key: 'arrow_keys' as InputMode, label: 'Arrow Keys', icon: '\u2328' },
            { key: 'llm' as InputMode, label: 'AI Generate', icon: '\u2728' },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                mode === key
                  ? 'bg-white text-amber-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className="mr-1">{icon}</span> {label}
            </button>
          ))}
        </div>

        {/* Drag & Drop Mode */}
        {mode === 'drag_drop' && (
          <div className="flex gap-4">
            {/* Palette */}
            <div className="flex-shrink-0 w-36">
              <DirectionPalette onAdd={handleAddDirection} />
            </div>

            {/* Rule List */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Rule Sequence
              </label>

              {rules.length === 0 ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={handleDropFromPalette}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400 hover:border-amber-400 hover:text-amber-500 transition-colors"
                >
                  <div className="text-3xl mb-2">+</div>
                  <div className="text-sm">Drag directions here or click to add</div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={handleDropFromPalette}
                  className="space-y-2"
                >
                  {rules.map((rule, index) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      index={index}
                      onUpdate={handleUpdateRule}
                      onRemove={handleRemoveRule}
                      onDragStart={handleRuleDragStart}
                      onDragOver={handleRuleDragOver}
                      onDragEnd={handleRuleDragEnd}
                      isDragOver={dragOverIndex === index}
                    />
                  ))}
                </div>
              )}

              {rules.length > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Clear all rules
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Arrow Keys Mode */}
        {mode === 'arrow_keys' && (
          <ArrowKeyInput
            sequence={arrowSequence}
            onSequenceChange={handleArrowSequenceChange}
          />
        )}

        {/* LLM Mode */}
        {mode === 'llm' && (
          <LLMRuleGenerator onRuleSetGenerated={handleLLMGenerated} />
        )}

        {/* Preview */}
        {rules.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              Preview
            </label>
            <RuleSetPreview ruleSet={currentRuleSet} />
          </div>
        )}

        {/* Save / Load buttons */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={rules.length === 0}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Rule Set
          </button>
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            {showSaved ? 'Hide' : 'My Rule Sets'} ({savedRuleSets.length})
          </button>
        </div>

        {/* Saved Rule Sets */}
        {showSaved && (
          <div className="space-y-2">
            {savedRuleSets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No saved rule sets yet</p>
            ) : (
              savedRuleSets.map(rs => (
                <div
                  key={rs.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-gray-800 truncate">{rs.name}</div>
                    <div className="text-xs text-gray-500">
                      {rs.rules.length} rules | Source: {rs.source}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <button
                      onClick={() => onLoad(rs)}
                      className="px-3 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-medium"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => onDelete(rs.id)}
                      className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleBuilder;
