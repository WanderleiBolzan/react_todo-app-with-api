/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable prettier/prettier */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

// Define the Todo interface and TodoStatus type directly within App.tsx
export interface Todo {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  createdAt: Timestamp;
}

export type TodoStatus = 'all' | 'active' | 'completed';

// UserWarning Component
const UserWarning: React.FC = () => {
  return (
    <div
      className="section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        textAlign: 'center',
      }}
    >
      <h1 className="title is-3 has-text-danger">Authentication Required</h1>
      <p className="subtitle is-5">
        Please ensure your Firebase project is set up correctly
        <br />
        and you are logged in.
      </p>
      <p className="block">
        If you are running this in a development environment,
        <br />
        ensure the `__initial_auth_token` or anonymous sign-in is
        <br />
        properly configured.
      </p>
    </div>
  );
};

// TodoItem Component
interface TodoItemProps {
  todo: Todo;
  onToggle: (todo: Todo) => Promise<void>;
  onDelete: (todoId: string) => Promise<void>;
  onRename: (todoId: string, newTitle: string) => Promise<void>;
  isLoading: boolean;
}

const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onDelete,
  onRename,
  isLoading,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(todo.title);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setNewTitle(todo.title); // Reset newTitle to current todo title on double click
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setNewTitle(todo.title); // Revert to original title
      setIsEditing(false); // Cancel editing
    }
  };

  // Define handleBlur BEFORE handleSubmit
  const handleBlur = async () => {
    const trimmedTitle = newTitle.trim();

    if (trimmedTitle === todo.title) {
      setIsEditing(false);

      return;
    }

    if (trimmedTitle === '') {
      await onDelete(todo.id); // Delete if new title is empty
    } else {
      await onRename(todo.id, trimmedTitle);
    }

    setIsEditing(false);
  };

  // handleSubmit now correctly calls handleBlur because it's defined above
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await handleBlur();
  };

  return (
    <div className={`todo ${todo.completed ? 'completed' : ''}`}>
      {/* Correct structure: input element is correctly nested inside label */}
      <label className="todo__status" htmlFor={`todo-status-toggle-${todo.id}`}>
        <input
          id={`todo-status-toggle-${todo.id}`}
          type="checkbox"
          className="todo__status-toggle"
          checked={todo.completed}
          onChange={() => onToggle(todo)}
          disabled={isLoading}
        />
      </label>

      {isEditing ? (
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="todo__title-field"
            placeholder="Empty todo will be deleted"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            ref={editInputRef}
            disabled={isLoading}
          />
        </form>
      ) : (
        <>
          <span
            className="todo__title"
            onDoubleClick={handleDoubleClick}
          >
            {todo.title}
          </span>

          <button
            type="button"
            className="todo__remove"
            onClick={() => onDelete(todo.id)}
            disabled={isLoading}
          >
            ×
          </button>
        </>
      )}

      {isLoading && <div className="loader" />}
    </div>
  );
};

// TodoList Component
interface TodoListProps {
  todos: Todo[];
  onToggle: (todo: Todo) => Promise<void>;
  onDelete: (todoId: string) => Promise<void>;
  onRename: (todoId: string, newTitle: string) => Promise<void>;
  processingTodoIds: Set<string>;
}

const TodoList: React.FC<TodoListProps> = ({
  todos,
  onToggle,
  onDelete,
  onRename,
  processingTodoIds,
}) => {
  return (
    <section className="todoapp__main">
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
          onRename={onRename}
          isLoading={processingTodoIds.has(todo.id)}
        />
      ))}
    </section>
  );
};

// TodoFilter Component
interface TodoFilterProps {
  currentFilter: TodoStatus;
  onFilterChange: (filter: TodoStatus) => void;
}

const TodoFilter: React.FC<TodoFilterProps> = ({
  currentFilter,
  onFilterChange,
}) => {
  return (
    <nav className="filter">
      <a
        href="#/"
        className={`filter__link ${currentFilter === 'all' ? 'selected' : ''}`}
        onClick={() => onFilterChange('all')}
      >
        All
      </a>

      <a
        href="#/active"
        className={`filter__link ${currentFilter === 'active' ? 'selected' : ''}`}
        onClick={() => onFilterChange('active')}
      >
        Active
      </a>

      <a
        href="#/completed"
        className={`filter__link ${currentFilter === 'completed' ? 'selected' : ''}`}
        onClick={() => onFilterChange('completed')}
      >
        Completed
      </a>
    </nav>
  );
};

// ErrorNotification Component
interface ErrorNotificationProps {
  message: string | null;
  onClose: () => void;
}

const ErrorNotification:
React.FC<ErrorNotificationProps> = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose(); // Call onClose after fading out
      }, 3000); // Display for 3 seconds

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [message, onClose]);

  if (!isVisible && !message) {
    return null;
  }

  return (
    <div className={`notification is-danger is-light has-text-weight-normal ${isVisible ? 'fade-in' : 'fade-out'}`}>
      <button
        type="button"
        className="delete"
        onClick={() => {
          setIsVisible(false);
          onClose();
        }}
      />
      {message}
    </div>
  );
};

declare const __app_id: string;
declare const __firebase_config: string;
declare const __initial_auth_token: string | undefined;

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Directly export the App component
const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null); // For optimistic updates of new todo
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<TodoStatus>('all');
  const [processingTodoIds,
    setProcessingTodoIds] = useState<Set<string>>(new Set());
  const newTodoTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            // Sign in anonymously if no custom token is provided
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error('Firebase authentication failed:', error);
          setErrorMessage('Authentication failed. Please refresh the page.');
        }
      }

      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen for todos from Firestore
  useEffect(() => {
    if (!isAuthReady || !userId) {
      return () => {};
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const todosCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/todos`);
    const q = query(todosCollectionRef, orderBy('createdAt', 'asc')); // Order by createdAt for consistent display

    const unsubscribeSnapshot = onSnapshot(q,
      (snapshot) => {
        const todosData: Todo[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Todo, 'id' | 'createdAt'>,
          createdAt: doc.data().createdAt as Timestamp,
        }));

        setTodos(todosData);
        setLoading(false);
        setTempTodo(null);
        setProcessingTodoIds(prev => {
          const newSet = new Set(prev);

          todosData.forEach(todo => newSet.delete(todo.id));

          return newSet;
        });
      },
      (error) => {
        console.error('Error fetching todos:', error);
        setErrorMessage('Failed to load todos.');
        setLoading(false);
      }
    );

    setLoading(true);

    return () => unsubscribeSnapshot();
  }, [isAuthReady, userId]);

  useEffect(() => {
    if (newTodoTitleRef.current && !loading) {
      newTodoTitleRef.current.focus();
    }
  }, [loading]);

  const showNotification = useCallback((message: string) => {
    setErrorMessage(message);
    const timer = setTimeout(() => {
      setErrorMessage(null);
    }, 3000); // Hide after 3 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleAddTodo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) {
      showNotification('User not authenticated.');

      return;
    }

    const title = newTodoTitleRef.current?.value.trim();

    if (!title) {
      showNotification('Title cannot be empty');

      return;
    }

    const newTodoData = {
      userId: userId,
      title,
      completed: false,
      createdAt: serverTimestamp(), // Use serverTimestamp for Firestore
    };

    setTempTodo({ ...newTodoData,
      id: 'temp-id',
      createdAt: new Timestamp(Math.floor(Date.now() / 1000), 0) });
    newTodoTitleRef.current!.value = '';
    setLoading(true);

    try {
      const appId = typeof __app_id
      !== 'undefined' ? __app_id : 'default-app-id';
      const todosCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/todos`);

      await addDoc(todosCollectionRef, newTodoData);
    } catch (error) {
      console.error('Error adding todo:', error);
      showNotification('Unable to add a todo');
      setLoading(false);
      setTempTodo(null);
    }
  };

  const handleDeleteTodo = useCallback(async (todoId: string) => {
    if (!userId) {
      showNotification('User not authenticated.');

      return;
    }

    setProcessingTodoIds(prev => new Set([...Array.from(prev), todoId])); // Fixed spread on Set

    try {
      const appId = typeof __app_id
      !== 'undefined' ? __app_id : 'default-app-id';

      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/todos`, todoId));
      showNotification('Todo deleted successfully!');
    } catch (error) {
      console.error('Error deleting todo:', error);
      showNotification('Unable to delete a todo');
    } finally {
      setProcessingTodoIds(prev => {
        const newSet = new Set(prev);

        newSet.delete(todoId);

        return newSet;
      });
    }
  }, [userId, showNotification]);

  const handleToggleTodo = useCallback(async (todo: Todo) => {
    if (!userId) {
      showNotification('User not authenticated.');

      return;
    }

    setProcessingTodoIds(prev => new Set([...Array.from(prev), todo.id])); // Fixed spread on Set

    try {
      const appId = typeof __app_id
      !== 'undefined' ? __app_id : 'default-app-id';

      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/todos`, todo.id), {
        completed: !todo.completed,
      });
    } catch (error) {
      console.error('Error toggling todo status:', error);
      showNotification('Unable to update a todo');
    } finally {
      setProcessingTodoIds(prev => {
        const newSet = new Set(prev);

        newSet.delete(todo.id);

        return newSet;
      });
    }
  }, [userId, showNotification]);

  const handleRenameTodo = useCallback(async (
    todoId: string, newTitle: string) => {
    if (!userId) {
      showNotification('User not authenticated.');

      return;
    }

    const currentTodo = todos.find(t => t.id === todoId);

    if (!currentTodo) {
      return; // Should not happen
    }

    if (newTitle.trim() === '') {
      await handleDeleteTodo(todoId);

      return;
    }

    if (newTitle === currentTodo.title) {
      return;
    }

    setProcessingTodoIds(prev => new Set([...Array.from(prev), todoId])); // Fixed spread on Set

    try {
      const appId = typeof __app_id
      !== 'undefined' ? __app_id : 'default-app-id';

      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/todos`, todoId), {
        title: newTitle,
      });
    } catch (error) {
      console.error('Error renaming todo:', error);
      showNotification('Unable to update a todo');
    } finally {
      setProcessingTodoIds(prev => {
        const newSet = new Set(prev);

        newSet.delete(todoId);

        return newSet;
      });
    }
  }, [userId, todos, handleDeleteTodo, showNotification]);

  const handleToggleAll = useCallback(async () => {
    if (!userId) {
      showNotification('User not authenticated.');

      return;
    }

    const allCompleted = todos.every(todo => todo.completed);
    const todosToUpdate = todos.filter(todo => todo.completed === allCompleted);

    if (todosToUpdate.length === 0) {
      return; // No todos to update
    }

    const newCompletedStatus = !allCompleted;
    const updatePromises: Promise<void>[] = [];
    const idsToProcess = new Set<string>();

    todosToUpdate.forEach(todo => {
      idsToProcess.add(todo.id);
      const appId = typeof __app_id
      !== 'undefined' ? __app_id : 'default-app-id';

      updatePromises.push(
        updateDoc(doc(db, `artifacts/${appId}/users/${userId}/todos`, todo.id), {
          completed: newCompletedStatus,
        }).catch(error => {
          console.error(`Error toggling todo ${todo.id}:`, error);
          showNotification('Unable to update a todo');
          throw error;
        })
      );
    });

    setProcessingTodoIds(prev => new
    Set([...Array.from(prev), ...Array.from(idsToProcess)]));

    try {
      await Promise.allSettled(updatePromises);
    } finally {
      setProcessingTodoIds(prev => {
        const newSet = new Set(prev);

        idsToProcess.forEach(id => newSet.delete(id));

        return newSet;
      });
    }
  }, [todos, userId, showNotification]);

  const handleClearCompleted = useCallback(async () => {
    if (!userId) {
      showNotification('User not authenticated.');

      return;
    }

    const completedTodos = todos.filter(todo => todo.completed);

    if (completedTodos.length === 0) {
      return;
    }

    const deletePromises: Promise<void>[] = [];
    const idsToProcess = new Set<string>();

    completedTodos.forEach(todo => {
      idsToProcess.add(todo.id);
      const appId = typeof __app_id
      !== 'undefined' ? __app_id : 'default-app-id';

      deletePromises.push(
        deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/todos`, todo.id)).catch(error => {
          console.error(`Error deleting completed todo ${todo.id}:`, error);
          showNotification('Unable to delete completed todos');
          throw error;
        })
      );
    });

    setProcessingTodoIds(prev => new
    Set([...Array.from(prev), ...Array.from(idsToProcess)]));

    try {
      await Promise.allSettled(deletePromises);
    } finally {
      setProcessingTodoIds(prev => {
        const newSet = new Set(prev);

        idsToProcess.forEach(id => newSet.delete(id));

        return newSet;
      });
    }
  }, [todos, userId, showNotification]);

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') {
      return !todo.completed;
    }

    if (filter === 'completed') {
      return todo.completed;
    }

    return true;
  });

  const activeTodosCount = todos.filter(todo => !todo.completed).length;
  const hasCompletedTodos = todos.some(todo => todo.completed);
  const allTodosCompleted = todos.length > 0 && activeTodosCount === 0;

  if (!isAuthReady) {
    return (
      <section className="section container">
        <p className="title is-4">Loading application...</p>
      </section>
    );
  }

  if (!userId) {
    return <UserWarning />;
  }

  const todosToRender = tempTodo ? [...filteredTodos, tempTodo] : filteredTodos;

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {todos.length > 0 && (
            <button
              type="button"
              className={`todoapp__toggle-all ${allTodosCompleted ? 'active' : ''}`}
              onClick={handleToggleAll}
            >
              <i className="fa fa-angle-down" />
            </button>
          )}

          <form onSubmit={handleAddTodo}>
            <input
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              ref={newTodoTitleRef}
              disabled={loading}
            />
          </form>
        </header>

        <TodoList
          todos={todosToRender}
          onToggle={handleToggleTodo}
          onDelete={handleDeleteTodo}
          onRename={handleRenameTodo}
          processingTodoIds={processingTodoIds}
        />

        {todos.length > 0 && (
          <footer className="todoapp__footer">
            <span className="todo-count">
              {activeTodosCount}
              {activeTodosCount === 1 ? 'item' : 'items'} left
            </span>

            <TodoFilter
              currentFilter={filter}
              onFilterChange={setFilter}
            />

            <button
              type="button"
              className="todoapp__clear-completed"
              disabled={!hasCompletedTodos || loading}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <ErrorNotification message={errorMessage}
        onClose={() => setErrorMessage(null)} />
    </div>
  );
};

export default App;
