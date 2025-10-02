const TestReturn = () => {
  return (
    <div className="bg-slate-50 p-4 sm:p-6 rounded-lg min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <h2>Test</h2>
      </div>

      {true ? (
        <div className="mb-6">
          <p>True case</p>
        </div>
      ) : (
        <div>
          <p>False case</p>
        </div>
      )}

      {false && (
        <div>Modal 1</div>
      )}
      {false && (
        <div>Modal 2</div>
      )}
      <div>Always visible</div>
    </div>
  );
};
