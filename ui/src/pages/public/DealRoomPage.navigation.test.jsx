import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceTabNav } from './DealRoomPage';

describe('Deal Room task navigation', () => {
  test('shows Tasks for a custom live room, including participant views', () => {
    const onChange = jest.fn();
    render(
      <WorkspaceTabNav
        activeTab="overview"
        onChange={onChange}
        isCustom
        isCoordinator={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));

    expect(onChange).toHaveBeenCalledWith('tasks');
  });

  test('does not show Tasks for a non-custom room', () => {
    const props = { isCustom: false, isDemo: false };
    render(<WorkspaceTabNav activeTab="overview" onChange={jest.fn()} {...props} />);

    expect(screen.queryByRole('button', { name: 'Tasks' })).not.toBeInTheDocument();
  });

  test('keeps Tasks available whenever the existing custom-room panel is enabled', () => {
    render(<WorkspaceTabNav activeTab="overview" onChange={jest.fn()} isCustom isDemo />);

    expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument();
  });
});
