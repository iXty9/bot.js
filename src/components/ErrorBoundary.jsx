import React from 'react';
import { Alert, AlertDescription } from './ui/alert';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('Error caught by boundary:', error);
    console.error('Error stack:', errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              <div className="font-bold mb-2">Something went wrong</div>
              <div className="text-sm opacity-90">
                {this.state.error && this.state.error.toString()}
              </div>
              {this.state.errorInfo && (
                <pre className="mt-2 p-2 bg-secondary/50 rounded text-xs overflow-auto">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
