import { CardButton, CardText, ResultCard } from '../scene/result-card';

export interface OutcomeCardProps {
  readonly title: string;
  readonly description: string;
  /** The next step: listen again, or open the settings. The one prominent button. */
  readonly action: { readonly label: string; readonly onPress: () => void };
  readonly testID: string;
}

/**
 * A listening that ends without a passage: the same card as a result, in the same place. Its
 * title says what happened, the sentence under it what to do, without blame, and its button is
 * that next step (writing.md › Best practices: clear error messages, clear next steps).
 */
export function OutcomeCard({ title, description, action, testID }: OutcomeCardProps) {
  return (
    <ResultCard
      title={title}
      testID={testID}
      actions={
        <CardButton label={action.label} onPress={action.onPress} testID={`${testID}-action`} />
      }
    >
      <CardText>{description}</CardText>
    </ResultCard>
  );
}
